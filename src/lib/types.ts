export const STATUSES = ["PENDING", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED", "TBD"] as const;
export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export const BUDGET_STATUSES = ["NOT_STARTED", "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "NOT_REQUIRED"] as const;
export const DOC_TYPES = [
  "QUOTATION", "INVOICE", "APPROVAL", "PDF", "IMAGE", "SPREADSHEET", "DOCUMENT", "NOTE", "FOLDER", "EMAIL", "OTHER",
] as const;
export const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type DocType = (typeof DOC_TYPES)[number];
export type Frequency = (typeof FREQUENCIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  TBD: "TBD",
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "P0 · Urgent",
  P1: "P1 · Important",
  P2: "P2 · Normal",
  P3: "P3 · Future",
};
export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NOT_REQUIRED: "Not required",
};
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  QUOTATION: "Quotation",
  INVOICE: "Invoice",
  APPROVAL: "Approval",
  PDF: "PDF",
  IMAGE: "Image",
  SPREADSHEET: "Excel / Sheet",
  DOCUMENT: "Document",
  NOTE: "Note",
  FOLDER: "Drive folder",
  EMAIL: "Email",
  OTHER: "Other",
};

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: Status;
  priority: Priority;
  owner: string | null;
  start_date: string | null;
  target_date: string | null;
  estimated_budget: number | null;
  quoted_amount: number | null;
  approved_budget: number | null;
  actual_spend: number;
  remaining_budget: number;
  budget_status: BudgetStatus;
  waiting_for: string | null;
  current_stage: string | null;
  next_action: string | null;
  drive_folder_url: string | null;
  is_recurring: boolean;
  aliases: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  owner: string | null;
  assigned_to: string | null;
  due_date: string | null;
  start_date: string | null;
  waiting_for: string | null;
  waiting_since: string | null;
  dependency: string | null;
  depends_on_task_id: string | null;
  next_action: string | null;
  next_task_id: string | null;
  estimated_budget: number | null;
  approved_budget: number | null;
  actual_spend: number | null;
  notes: string | null;
  checklist: ChecklistItem[];
  recurring_template_id: string | null;
  occurrence_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Task with values the app works out (project name, overdue, blocked...). */
export interface TaskView extends Task {
  projectName: string;
  projectSlug: string;
  isOpen: boolean;
  isOverdue: boolean;
  isDueToday: boolean;
  isWaiting: boolean;
  waitingDays: number | null;
  blockedBy: { id: string; title: string } | null;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  doc_type: DocType;
  url: string | null;
  storage_path: string | null;
  vendor: string | null;
  amount: number | null;
  is_l1: boolean;
  notes: string | null;
  external_ref: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  project_id: string;
  task_id: string | null;
  description: string;
  amount: number;
  spent_on: string;
  vendor: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  project_id: string | null;
  task_id: string | null;
  entity_type: string;
  entity_title: string | null;
  action: string;
  field: string | null;
  previous_value: string | null;
  new_value: string | null;
  actor_name: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  task_id: string | null;
  project_id: string | null;
  title: string;
  message: string | null;
  remind_at: string;
  kind: "MANUAL" | "WAITING_FOLLOWUP" | "OVERDUE";
  status: "PENDING" | "SENT" | "DISMISSED";
  sent_at: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  report_type: "DAILY" | "WEEKLY" | "MORNING_DIGEST" | "EVENING_DIGEST";
  title: string;
  content: string;
  status: "DRAFT" | "REVIEWED" | "SENT";
  generated_at: string;
  sent_at: string | null;
}

export interface RecurringTemplate {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  frequency: Frequency;
  interval_days: number | null;
  weekday: number | null;
  month_day: number | null;
  checklist: string[];
  priority: Priority;
  assigned_to: string | null;
  start_date: string;
  active: boolean;
  last_generated_date: string | null;
}

export interface AppSettings {
  timezone: string;
  morning_reminder_time: string;
  evening_reminder_time: string;
  waiting_followup_days: number;
  reminders_enabled: boolean;
  last_morning_digest: string | null;
  last_evening_digest: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: "admin" | "member" | "viewer";
}
