"use server";

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/lib/auth";
import { zonedToUtc } from "@/lib/dates";
import { loadWorkspace } from "@/lib/data/workspace";
import { buildManagerUpdate, type ReportKind } from "@/lib/reports";
import {
  firstError,
  formToObject,
  reminderSchema,
  settingsSchema,
  templateSchema,
  type ActionResult,
} from "@/lib/validation";

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session expired. Please sign in again." };
const READ_ONLY: ActionResult = { ok: false, error: "Your account is view-only. Ask an admin for edit access." };

// ---------------- Reports ----------------

export async function generateReport(kind: ReportKind): Promise<ActionResult & { title?: string; content?: string }> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  const ws = await loadWorkspace(ctx.supabase);
  const r = buildManagerUpdate(ws, kind);
  return { ok: true, ...r };
}

export async function saveReport(input: {
  id?: string;
  kind: ReportKind;
  title: string;
  content: string;
  status: "DRAFT" | "REVIEWED" | "SENT";
}): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  if (!input.content.trim()) return { ok: false, error: "Report is empty" };
  if (input.content.length > 50_000) return { ok: false, error: "Report is too long" };
  const row = {
    report_type: input.kind,
    title: input.title.slice(0, 300),
    content: input.content,
    status: input.status,
    sent_at: input.status === "SENT" ? new Date().toISOString() : null,
  };
  const q = input.id
    ? ctx.supabase.from("reports").update(row).eq("id", input.id).select("id").single()
    : ctx.supabase.from("reports").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reports");
  return { ok: true, id: data.id, message: input.status === "SENT" ? "Marked as sent" : "Saved" };
}

// ---------------- Reminders ----------------

export async function createReminder(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = reminderSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { data: settings } = await ctx.supabase.from("app_settings").select("timezone").eq("id", 1).maybeSingle();
  const remindAt = zonedToUtc(parsed.data.date, parsed.data.time, settings?.timezone ?? "Asia/Kolkata");
  const { error } = await ctx.supabase.from("reminders").insert({
    title: parsed.data.title,
    message: parsed.data.message,
    task_id: parsed.data.task_id,
    project_id: parsed.data.project_id,
    remind_at: remindAt.toISOString(),
    kind: "MANUAL",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Reminder set" };
}

export async function dismissReminder(id: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error } = await ctx.supabase.from("reminders").update({ status: "DISMISSED" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Settings ----------------

export async function updateSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can change settings." };
  const raw = formToObject(formData);
  const parsed = settingsSchema.safeParse({ ...raw, reminders_enabled: formData.get("reminders_enabled") === "on" });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { error } = await ctx.supabase
    .from("app_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function updateMyProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  const full_name = String(formData.get("full_name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(0, 15) || null;
  if (!full_name) return { ok: false, error: "Name is required" };
  const { error } = await ctx.supabase.from("profiles").update({ full_name, phone }).eq("id", ctx.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, message: "Profile saved" };
}

// ---------------- Recurring templates ----------------

export async function saveTemplate(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const raw = formToObject(formData);
  const checklist = (raw.checklist ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = templateSchema.safeParse({ ...raw, checklist });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const id = raw.id;
  const { error } = id
    ? await ctx.supabase.from("recurring_templates").update(parsed.data).eq("id", id)
    : await ctx.supabase.from("recurring_templates").insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Recurring task saved" };
}

export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error } = await ctx.supabase.from("recurring_templates").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error } = await ctx.supabase.from("recurring_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Recurring task removed" };
}

export async function runRecurringNow(): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { data: settings } = await ctx.supabase.from("app_settings").select("timezone").eq("id", 1).maybeSingle();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings?.timezone ?? "Asia/Kolkata" }).format(new Date());
  const { data, error } = await ctx.supabase.rpc("generate_recurring_tasks", { p_date: today });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `${data ?? 0} recurring task(s) created for today` };
}
