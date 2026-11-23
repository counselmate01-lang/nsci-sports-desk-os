import { z } from "zod";
import { BUDGET_STATUSES, DOC_TYPES, FREQUENCIES, PRIORITIES, STATUSES } from "@/lib/types";

// Shared input rules for forms, the AI assistant and webhooks.
// Everything coming from a browser or an AI is checked here before it reaches the database.

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optText = (max = 2000) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
export const reqText = (max = 300) => z.string().trim().min(1, "Required").max(max);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const optDate = z.preprocess(blankToNull, isoDate.nullable().optional());
export const optMoney = z.preprocess(
  (v) => {
    const b = blankToNull(v);
    if (typeof b === "string") return Number(b.replace(/[,₹\s]/g, ""));
    return b;
  },
  z.number({ message: "Enter a number" }).min(0, "Cannot be negative").max(1_000_000_000).nullable().optional(),
);
export const optUuid = z.preprocess(blankToNull, z.string().uuid().nullable().optional());
export const optUrl = z.preprocess(
  blankToNull,
  z.string().trim().url("Enter a full link starting with https://").refine((u) => /^https?:\/\//i.test(u), "Link must start with http(s)://").nullable().optional(),
);

export const statusEnum = z.enum(STATUSES);
export const priorityEnum = z.enum(PRIORITIES);
export const budgetStatusEnum = z.enum(BUDGET_STATUSES);
export const docTypeEnum = z.enum(DOC_TYPES);
export const frequencyEnum = z.enum(FREQUENCIES);

export const taskCreateSchema = z.object({
  title: reqText(200),
  project_id: z.string().uuid("Choose a project"),
  priority: priorityEnum,
  status: statusEnum,
  due_date: isoDate,
  owner: optText(100),
  assigned_to: optText(100),
  waiting_for: optText(200),
  dependency: optText(300),
  depends_on_task_id: optUuid,
  estimated_budget: optMoney,
  notes: optText(5000),
  description: optText(5000),
  attachment_url: optUrl,
  attachment_title: optText(200),
});

export const taskUpdateSchema = z.object({
  title: reqText(200),
  project_id: z.string().uuid(),
  priority: priorityEnum,
  status: statusEnum,
  due_date: optDate,
  start_date: optDate,
  owner: optText(100),
  assigned_to: optText(100),
  waiting_for: optText(200),
  dependency: optText(300),
  depends_on_task_id: optUuid,
  next_task_id: optUuid,
  next_action: optText(300),
  estimated_budget: optMoney,
  approved_budget: optMoney,
  actual_spend: optMoney,
  notes: optText(5000),
  description: optText(5000),
});

export const projectSchema = z.object({
  name: reqText(120),
  description: optText(2000),
  status: statusEnum,
  priority: priorityEnum,
  owner: optText(100),
  start_date: optDate,
  target_date: optDate,
  waiting_for: optText(200),
  current_stage: optText(200),
  next_action: optText(300),
  drive_folder_url: optUrl,
});

export const projectBudgetSchema = z.object({
  estimated_budget: optMoney,
  quoted_amount: optMoney,
  approved_budget: optMoney,
  budget_status: budgetStatusEnum,
});

export const documentSchema = z
  .object({
    project_id: z.string().uuid(),
    task_id: optUuid,
    title: reqText(200),
    doc_type: docTypeEnum,
    url: optUrl,
    vendor: optText(120),
    amount: optMoney,
    notes: optText(2000),
    storage_path: optText(500),
  })
  .refine((d) => d.url || d.notes || d.storage_path, { message: "Add a link, a file or a note", path: ["url"] });

export const expenseSchema = z.object({
  project_id: z.string().uuid(),
  task_id: optUuid,
  description: reqText(200),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,₹\s]/g, "")) : v),
    z.number({ message: "Enter an amount" }).positive("Must be more than 0").max(1_000_000_000),
  ),
  spent_on: isoDate,
  vendor: optText(120),
});

export const reminderSchema = z.object({
  title: reqText(200),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  task_id: optUuid,
  project_id: optUuid,
  message: optText(1000),
});

export const settingsSchema = z.object({
  timezone: reqText(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  morning_reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
  evening_reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
  waiting_followup_days: z.coerce.number().int().min(1).max(60),
  reminders_enabled: z.boolean(),
});

export const templateSchema = z
  .object({
    project_id: z.string().uuid(),
    title: reqText(200),
    description: optText(1000),
    frequency: frequencyEnum,
    interval_days: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(365).nullable().optional()),
    weekday: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(6).nullable().optional()),
    month_day: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(31).nullable().optional()),
    checklist: z.array(z.string().trim().min(1).max(200)).max(50),
    priority: priorityEnum,
    assigned_to: optText(100),
    start_date: isoDate,
  })
  .refine((t) => t.frequency !== "CUSTOM" || t.interval_days, { message: "Enter how many days apart", path: ["interval_days"] })
  .refine((t) => t.frequency !== "WEEKLY" || t.weekday !== null && t.weekday !== undefined, { message: "Choose a weekday", path: ["weekday"] })
  .refine((t) => t.frequency !== "MONTHLY" || t.month_day, { message: "Choose a day of the month", path: ["month_day"] });

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$")) out[key] = value;
  });
  return out;
}

export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".");
  return field ? `${field.replace(/_/g, " ")}: ${issue.message}` : issue.message;
}

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string; needsConfirm?: boolean };
