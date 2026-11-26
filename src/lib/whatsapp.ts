import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

// WhatsApp Cloud API helpers. All credentials come from environment variables.

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

/** Checks Meta's X-Hub-Signature-256 header so only Meta can call the webhook. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = serverEnv().whatsapp.appSecret;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendWhatsAppText(to: string, body: string) {
  const { accessToken, phoneNumberId } = serverEnv().whatsapp;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4000) },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) console.error("WhatsApp send failed", res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

export interface IncomingText {
  from: string;
  text: string;
  id: string;
}

/** Pulls the text messages out of a webhook payload (ignores status updates, media, etc.). */
export function extractTexts(payload: unknown): IncomingText[] {
  const out: IncomingText[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: { value?: { messages?: { from: string; id: string; type: string; text?: { body: string } }[] } }[] }[]) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type === "text" && m.text?.body) out.push({ from: m.from.replace(/\D/g, ""), text: m.text.body.slice(0, 2000), id: m.id });
      }
    }
  }
  return out;
}
