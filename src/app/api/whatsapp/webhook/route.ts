import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWhatsAppConfigured, serverEnv } from "@/lib/env";
import { loadWorkspace } from "@/lib/data/workspace";
import { runAssistant } from "@/lib/ai/engine";
import { assistantActionSchema, describeAction, executeAction } from "@/lib/ai/actions";
import { extractTexts, sendWhatsAppText, verifySignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// WhatsApp message -> this webhook -> Sports Desk AI -> (confirm) -> database -> reply.
// Disabled until all WHATSAPP_* variables are set. See docs/WHATSAPP.md.

// Meta calls GET once to verify the webhook URL.
export function GET(request: Request) {
  const url = new URL(request.url);
  const { verifyToken } = serverEnv().whatsapp;
  if (
    verifyToken &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === verifyToken
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const YES = /^(yes|y|confirm|ok|haan|ha)\.?$/i;
const NO = /^(no|n|cancel|stop)\.?$/i;

export async function POST(request: Request) {
  if (!isWhatsAppConfigured()) return NextResponse.json({ error: "WhatsApp is not configured" }, { status: 503 });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const allowed = new Set(serverEnv().whatsapp.allowedNumbers);
  const admin = createAdminClient();

  for (const msg of extractTexts(payload)) {
    if (!allowed.has(msg.from)) {
      // Unknown number: ignore silently (do not reveal anything).
      continue;
    }
    try {
      const reply = await handle(admin, msg.from, msg.text.trim());
      await sendWhatsAppText(msg.from, reply);
    } catch (e) {
      console.error("whatsapp handling failed", e);
      await sendWhatsAppText(msg.from, "Sorry, something went wrong. Please try again or use the app.");
    }
  }
  // Always 200 so Meta does not retry.
  return NextResponse.json({ ok: true });
}

async function handle(admin: ReturnType<typeof createAdminClient>, from: string, text: string): Promise<string> {
  const ws = await loadWorkspace(admin);

  if (YES.test(text) || NO.test(text)) {
    const { data: pending } = await admin
      .from("pending_actions")
      .select("*")
      .eq("sender", from)
      .eq("status", "PENDING")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pending) return "There is nothing waiting for confirmation.";
    if (NO.test(text)) {
      await admin.from("pending_actions").update({ status: "CANCELLED" }).eq("id", pending.id);
      return "Cancelled. Nothing was changed.";
    }
    const parsed = assistantActionSchema.safeParse(pending.action);
    if (!parsed.success) return "That request is no longer valid.";
    const check = describeAction(ws, parsed.data);
    if ("error" in check) return check.error;
    // Mark first so a duplicate "YES" cannot run it twice.
    const { data: claimed } = await admin
      .from("pending_actions")
      .update({ status: "CONFIRMED" })
      .eq("id", pending.id)
      .eq("status", "PENDING")
      .select("id");
    if (!claimed?.length) return "Already done.";
    const result = await executeAction(admin, parsed.data, ws.tz);
    return result.ok ? result.message : `Could not save: ${result.error}`;
  }

  const answer = await runAssistant(ws, [{ role: "user", content: text }], "whatsapp");
  if (!answer.proposals.length) return answer.reply;

  // Only one change at a time over WhatsApp.
  await admin.from("pending_actions").update({ status: "EXPIRED" }).eq("sender", from).eq("status", "PENDING");
  const first = answer.proposals[0];
  await admin.from("pending_actions").insert({ sender: from, action: first.action, summary: first.summary });
  const extra = answer.proposals.length > 1 ? `\n(${answer.proposals.length - 1} more change(s) skipped: send them one at a time.)` : "";
  return `${first.summary}${extra}\n\nReply YES to confirm or NO to cancel (expires in 15 minutes).`;
}
