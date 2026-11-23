import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { timeIn, formatDate } from "@/lib/dates";
import { loadWorkspace, type Workspace } from "@/lib/data/workspace";
import { dashboardStats } from "@/lib/data/stats";
import { buildEveningDigest, buildManagerUpdate, buildMorningDigest } from "@/lib/reports";

/** n8n must send:  Authorization: Bearer <AUTOMATION_SECRET> */
export function isAuthorizedAutomation(request: Request): boolean {
  const secret = serverEnv().automationSecret;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OutboundMessage {
  type: "MORNING_DIGEST" | "EVENING_DIGEST" | "WAITING_FOLLOWUP" | "REMINDER" | "OVERDUE" | "MANAGER_UPDATE";
  title: string;
  text: string;
}

async function saveDigest(admin: SupabaseClient, type: "MORNING_DIGEST" | "EVENING_DIGEST", title: string, content: string) {
  await admin.from("reports").insert({ report_type: type, title, content, status: "SENT", sent_at: new Date().toISOString() });
}

export async function morningDigest(admin: SupabaseClient, ws: Workspace): Promise<OutboundMessage> {
  const d = buildMorningDigest(ws);
  await saveDigest(admin, "MORNING_DIGEST", d.title, d.content);
  await admin.from("app_settings").update({ last_morning_digest: ws.today }).eq("id", 1);
  return { type: "MORNING_DIGEST", title: d.title, text: d.content };
}

export async function eveningDigest(admin: SupabaseClient, ws: Workspace): Promise<OutboundMessage> {
  const d = buildEveningDigest(ws);
  await saveDigest(admin, "EVENING_DIGEST", d.title, d.content);
  await admin.from("app_settings").update({ last_evening_digest: ws.today }).eq("id", 1);
  return { type: "EVENING_DIGEST", title: d.title, text: d.content };
}

export function overdueMessage(ws: Workspace): OutboundMessage | null {
  const s = dashboardStats(ws);
  if (!s.overdue.length) return null;
  return {
    type: "OVERDUE",
    title: `${s.overdue.length} overdue task(s)`,
    text: s.overdue
      .slice(0, 20)
      .map((t) => `• ${t.title} (${t.projectName}) – was due ${formatDate(t.due_date, ws.today)}`)
      .join("\n"),
  };
}

/** Creates follow-up reminders for tasks waiting longer than the configured number of days. */
export async function waitingFollowups(admin: SupabaseClient, ws: Workspace): Promise<OutboundMessage[]> {
  const days = ws.settings.waiting_followup_days;
  const candidates = ws.tasks.filter((t) => t.isWaiting && (t.waitingDays ?? 0) >= days);
  if (!candidates.length) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: recent } = await admin
    .from("reminders")
    .select("task_id")
    .eq("kind", "WAITING_FOLLOWUP")
    .gte("created_at", since)
    .in("task_id", candidates.map((t) => t.id));
  const skip = new Set((recent ?? []).map((r) => r.task_id));
  const out: OutboundMessage[] = [];
  for (const t of candidates) {
    if (skip.has(t.id)) continue;
    const title = `Follow up: ${t.title}`;
    const message = `Waiting ${t.waitingDays} day${t.waitingDays === 1 ? "" : "s"}${t.waiting_for ? ` for ${t.waiting_for}` : ""} (${t.projectName}).`;
    const { error } = await admin.from("reminders").insert({
      task_id: t.id,
      project_id: t.project_id,
      title,
      message,
      remind_at: new Date().toISOString(),
      kind: "WAITING_FOLLOWUP",
    });
    if (!error) out.push({ type: "WAITING_FOLLOWUP", title, text: message });
  }
  return out;
}

/** Manual reminders whose time has come. Marks them as sent. */
export async function dueReminders(admin: SupabaseClient): Promise<OutboundMessage[]> {
  const { data } = await admin
    .from("reminders")
    .select("id, title, message, kind")
    .eq("status", "PENDING")
    .eq("kind", "MANUAL")
    .is("sent_at", null)
    .lte("remind_at", new Date().toISOString())
    .limit(50);
  if (!data?.length) return [];
  await admin
    .from("reminders")
    .update({ sent_at: new Date().toISOString() })
    .in("id", data.map((r) => r.id));
  return data.map((r) => ({ type: "REMINDER" as const, title: r.title, text: r.message ?? r.title }));
}

/**
 * One call does everything that is due. n8n calls this every 15 minutes.
 * Reminder times come from Settings, so changing them in the app is enough.
 */
export async function runTick(admin: SupabaseClient) {
  let ws = await loadWorkspace(admin);
  const created = await admin.rpc("generate_recurring_tasks", { p_date: ws.today });
  if (!created.error && (created.data ?? 0) > 0) ws = await loadWorkspace(admin);

  const messages: OutboundMessage[] = [];
  const now = timeIn(ws.tz);
  const s = ws.settings;
  if (s.reminders_enabled) {
    if (now >= s.morning_reminder_time.slice(0, 5) && s.last_morning_digest !== ws.today && now < s.evening_reminder_time.slice(0, 5)) {
      messages.push(await morningDigest(admin, ws));
    }
    if (now >= s.evening_reminder_time.slice(0, 5) && s.last_evening_digest !== ws.today) {
      messages.push(await eveningDigest(admin, ws));
    }
    messages.push(...(await waitingFollowups(admin, ws)));
  }
  messages.push(...(await dueReminders(admin)));
  return { now: `${ws.today} ${now} ${ws.tz}`, recurring_created: created.data ?? 0, messages };
}

export { buildManagerUpdate };
