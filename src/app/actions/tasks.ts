"use server";

import { revalidatePath } from "next/cache";
import { getActionUser } from "@/lib/auth";
import {
  firstError,
  formToObject,
  statusEnum,
  priorityEnum,
  taskCreateSchema,
  taskUpdateSchema,
  type ActionResult,
} from "@/lib/validation";
import type { ChecklistItem } from "@/lib/types";

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Your session expired. Please sign in again." };
const READ_ONLY: ActionResult = { ok: false, error: "Your account is view-only. Ask an admin for edit access." };

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTask(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = taskCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { attachment_url, attachment_title, ...task } = parsed.data;

  // New tasks go to the end of the project's list
  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("sort_order")
    .eq("project_id", task.project_id)
    .is("recurring_template_id", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({ ...task, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (attachment_url) {
    const { error: docErr } = await ctx.supabase.from("documents").insert({
      project_id: task.project_id,
      task_id: data.id,
      title: attachment_title || "Attachment",
      doc_type: "DOCUMENT",
      url: attachment_url,
    });
    if (docErr) return { ok: true, id: data.id, message: `Task created, but the attachment failed: ${docErr.message}` };
  }
  refresh();
  return { ok: true, id: data.id, message: "Task created" };
}

export async function updateTask(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const id = String(formData.get("id") ?? "");
  const parsed = taskUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.depends_on_task_id === id || parsed.data.next_task_id === id) {
    return { ok: false, error: "A task cannot depend on itself." };
  }
  const { error } = await ctx.supabase.from("tasks").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Saved" };
}

export async function setTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = statusEnum.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status" };
  const { error } = await ctx.supabase.from("tasks").update({ status: parsed.data }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setTaskPriority(taskId: string, priority: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const parsed = priorityEnum.safeParse(priority);
  if (!parsed.success) return { ok: false, error: "Unknown priority" };
  const { error } = await ctx.supabase.from("tasks").update({ priority: parsed.data }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function toggleChecklistItem(taskId: string, index: number, done: boolean): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { data, error } = await ctx.supabase.from("tasks").select("checklist").eq("id", taskId).single();
  if (error) return { ok: false, error: error.message };
  const list = (Array.isArray(data.checklist) ? data.checklist : []) as ChecklistItem[];
  if (!list[index]) return { ok: false, error: "Checklist item not found" };
  list[index] = { ...list[index], done };
  const allDone = list.every((i) => i.done);
  const update: Record<string, unknown> = { checklist: list };
  const { error: upErr } = await ctx.supabase.from("tasks").update(update).eq("id", taskId);
  if (upErr) return { ok: false, error: upErr.message };
  refresh();
  return { ok: true, message: allDone ? "All items checked. Mark the checklist complete when ready." : undefined };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const ctx = await getActionUser();
  if (!ctx) return NOT_SIGNED_IN;
  if (ctx.role === "viewer") return READ_ONLY;
  const { error, count } = await ctx.supabase.from("tasks").delete({ count: "exact" }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Task not found or you are not allowed to delete it." };
  refresh();
  return { ok: true, message: "Task deleted" };
}
