import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate, zonedToUtc } from "@/lib/dates";
import { BUDGET_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/types";
import { budgetStatusEnum, isoDate, priorityEnum, statusEnum } from "@/lib/validation";
import type { Workspace } from "@/lib/data/workspace";

// Changes the assistant may PROPOSE. Nothing here runs until a person confirms.
// The assistant cannot delete anything.

const text = (max: number) => z.string().trim().min(1).max(max);
const clearable = (max: number) => z.string().trim().max(max).nullable(); // "" or null clears

export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    project_id: z.string().uuid(),
    title: text(200),
    priority: priorityEnum.default("P2"),
    status: statusEnum.default("PENDING"),
    due_date: isoDate,
    waiting_for: clearable(200).optional(),
    assigned_to: clearable(100).optional(),
    notes: clearable(2000).optional(),
  }),
  z.object({
    type: z.literal("update_task"),
    task_id: z.string().uuid(),
    changes: z
      .object({
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        due_date: isoDate.nullable().optional(),
        waiting_for: clearable(200).optional(),
        assigned_to: clearable(100).optional(),
        owner: clearable(100).optional(),
        title: text(200).optional(),
        notes_append: text(1000).optional(),
      })
      .refine((c) => Object.keys(c).length > 0, "No changes"),
  }),
  z.object({
    type: z.literal("update_project"),
    project_id: z.string().uuid(),
    changes: z
      .object({
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        waiting_for: clearable(200).optional(),
        next_action: clearable(300).optional(),
        current_stage: clearable(200).optional(),
        owner: clearable(100).optional(),
        target_date: isoDate.nullable().optional(),
        budget_status: budgetStatusEnum.optional(),
      })
      .refine((c) => Object.keys(c).length > 0, "No changes"),
  }),
  z.object({
    type: z.literal("create_reminder"),
    title: text(200),
    date: isoDate,
    time: z.string().regex(/^\d{2}:\d{2}$/),
    task_id: z.string().uuid().nullable().optional(),
    project_id: z.string().uuid().nullable().optional(),
  }),
]);

export type AssistantAction = z.infer<typeof assistantActionSchema>;

export interface ProposedAction {
  id: string;
  action: AssistantAction;
  summary: string;
  /** true for changes that are hard to undo (cancelling, completing a whole project). */
  destructive: boolean;
}

const nul = (v: string | null | undefined) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim());

function fmtChange(field: string, value: unknown): string {
  if (value === null || value === "") return `clear ${field.replace(/_/g, " ")}`;
  if (field === "status") return `status → ${STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? value}`;
  if (field === "priority") return `priority → ${PRIORITY_LABEL[value as keyof typeof PRIORITY_LABEL] ?? value}`;
  if (field === "budget_status") return `budget → ${BUDGET_STATUS_LABEL[value as keyof typeof BUDGET_STATUS_LABEL] ?? value}`;
  if (field === "due_date" || field === "target_date") return `${field === "due_date" ? "due" : "deadline"} → ${formatDate(String(value))}`;
  if (field === "notes_append") return `add note “${value}”`;
  return `${field.replace(/_/g, " ")} → ${value}`;
}

/** Checks a proposed action against the database and writes a plain-English summary. */
export function describeAction(ws: Workspace, action: AssistantAction): { summary: string; destructive: boolean } | { error: string } {
  switch (action.type) {
    case "create_task": {
      const p = ws.projects.find((x) => x.id === action.project_id);
      if (!p) return { error: "That project does not exist." };
      const bits = [`${action.priority}`, `due ${formatDate(action.due_date)}`];
      if (action.status !== "PENDING") bits.push(STATUS_LABEL[action.status]);
      if (action.waiting_for) bits.push(`waiting for ${action.waiting_for}`);
      if (action.assigned_to) bits.push(`assigned to ${action.assigned_to}`);
      return { summary: `Create task “${action.title}” in ${p.name} (${bits.join(", ")})`, destructive: false };
    }
    case "update_task": {
      const t = ws.tasks.find((x) => x.id === action.task_id);
      if (!t) return { error: "That task does not exist." };
      const changes = Object.entries(action.changes).map(([k, v]) => fmtChange(k, v));
      const destructive = action.changes.status === "CANCELLED";
      return { summary: `Update task “${t.title}” (${t.projectName}): ${changes.join(", ")}`, destructive };
    }
    case "update_project": {
      const p = ws.projects.find((x) => x.id === action.project_id);
      if (!p) return { error: "That project does not exist." };
      const changes = Object.entries(action.changes).map(([k, v]) => fmtChange(k, v));
      const destructive = action.changes.status === "CANCELLED" || action.changes.status === "COMPLETED";
      return { summary: `Update project “${p.name}”: ${changes.join(", ")}`, destructive };
    }
    case "create_reminder": {
      const t = action.task_id ? ws.tasks.find((x) => x.id === action.task_id) : null;
      const p = action.project_id ? ws.projects.find((x) => x.id === action.project_id) : null;
      if (action.task_id && !t) return { error: "That task does not exist." };
      if (action.project_id && !p) return { error: "That project does not exist." };
      const about = t ? ` (task: ${t.title})` : p ? ` (project: ${p.name})` : "";
      return { summary: `Set reminder “${action.title}” for ${formatDate(action.date)} at ${action.time}${about}`, destructive: false };
    }
  }
}

/** Runs a confirmed action. `supabase` is the signed-in user's client, so RLS applies. */
export async function executeAction(supabase: SupabaseClient, action: AssistantAction, tz: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  switch (action.type) {
    case "create_task": {
      const { data: last } = await supabase
        .from("tasks")
        .select("sort_order")
        .eq("project_id", action.project_id)
        .is("recurring_template_id", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("tasks").insert({
        project_id: action.project_id,
        title: action.title,
        priority: action.priority,
        status: action.status,
        due_date: action.due_date,
        waiting_for: nul(action.waiting_for) ?? null,
        assigned_to: nul(action.assigned_to) ?? null,
        notes: nul(action.notes) ?? null,
        sort_order: (last?.sort_order ?? 0) + 1,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `Task “${action.title}” created.` };
    }
    case "update_task": {
      const { notes_append, ...rest } = action.changes;
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) update[k] = typeof v === "string" ? nul(v) : v;
      if (notes_append) {
        const { data } = await supabase.from("tasks").select("notes").eq("id", action.task_id).single();
        const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date());
        update.notes = [data?.notes, `[${stamp}] ${notes_append}`].filter(Boolean).join("\n");
      }
      const { data, error } = await supabase.from("tasks").update(update).eq("id", action.task_id).select("title, status").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `Done. “${data.title}” updated${rest.status ? ` (now ${STATUS_LABEL[data.status as keyof typeof STATUS_LABEL]})` : ""}.` };
    }
    case "update_project": {
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(action.changes)) update[k] = typeof v === "string" ? nul(v) : v;
      const { data, error } = await supabase.from("projects").update(update).eq("id", action.project_id).select("name").single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `Done. ${data.name} updated.` };
    }
    case "create_reminder": {
      const remindAt = zonedToUtc(action.date, action.time, tz);
      const { error } = await supabase.from("reminders").insert({
        title: action.title,
        remind_at: remindAt.toISOString(),
        task_id: action.task_id ?? null,
        project_id: action.project_id ?? null,
        kind: "MANUAL",
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `Reminder set for ${formatDate(action.date)} at ${action.time}.` };
    }
  }
}

export function proposal(ws: Workspace, raw: unknown): ProposedAction | { error: string } {
  const parsed = assistantActionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = describeAction(ws, parsed.data);
  if ("error" in d) return d;
  return { id: crypto.randomUUID(), action: parsed.data, summary: d.summary, destructive: d.destructive };
}
