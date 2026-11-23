import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween, DEFAULT_TZ, todayIn } from "@/lib/dates";
import { num } from "@/lib/utils";
import type { AppSettings, Project, Task, TaskView } from "@/lib/types";

/**
 * The Sports Desk dataset is small (tens of projects, hundreds of tasks), so the
 * app loads projects + tasks once per request and works everything out in code.
 * This keeps the dashboard, filters, reports and AI answers consistent: they all
 * read the same numbers.
 */
export interface Workspace {
  projects: Project[];
  tasks: TaskView[];
  settings: AppSettings;
  today: string;
  tz: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  timezone: DEFAULT_TZ,
  morning_reminder_time: "09:00:00",
  evening_reminder_time: "18:30:00",
  waiting_followup_days: 3,
  reminders_enabled: true,
  last_morning_digest: null,
  last_evening_digest: null,
};

/** Reads every row of a table, 1000 at a time (Supabase returns max 1000 per request). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "WAITING"] as const;

export function isOpenStatus(status: string) {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

function normaliseProject(p: Project): Project {
  return {
    ...p,
    estimated_budget: p.estimated_budget === null ? null : num(p.estimated_budget),
    quoted_amount: p.quoted_amount === null ? null : num(p.quoted_amount),
    approved_budget: p.approved_budget === null ? null : num(p.approved_budget),
    actual_spend: num(p.actual_spend),
    remaining_budget: num(p.remaining_budget),
    aliases: p.aliases ?? [],
  };
}

export function enrichTasks(tasks: Task[], projects: Project[], today: string): TaskView[] {
  const byProject = new Map(projects.map((p) => [p.id, p]));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.map((t) => {
    const project = byProject.get(t.project_id);
    const isOpen = isOpenStatus(t.status);
    const dep = t.depends_on_task_id ? byId.get(t.depends_on_task_id) : undefined;
    const blocked = isOpen && dep && dep.status !== "COMPLETED" && dep.status !== "CANCELLED";
    const isWaiting = isOpen && (t.status === "WAITING" || Boolean(t.waiting_for?.trim()));
    return {
      ...t,
      estimated_budget: t.estimated_budget === null ? null : num(t.estimated_budget),
      approved_budget: t.approved_budget === null ? null : num(t.approved_budget),
      actual_spend: t.actual_spend === null ? null : num(t.actual_spend),
      checklist: Array.isArray(t.checklist) ? t.checklist : [],
      projectName: project?.name ?? "Unknown project",
      projectSlug: project?.slug ?? "",
      isOpen,
      isOverdue: isOpen && Boolean(t.due_date) && t.due_date! < today,
      isDueToday: isOpen && t.due_date === today,
      isWaiting,
      waitingDays: isWaiting && t.waiting_since ? Math.max(0, daysBetween(t.waiting_since.slice(0, 10), today)) : null,
      blockedBy: blocked && dep ? { id: dep.id, title: dep.title } : null,
    };
  });
}

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Urgent first, then by due date (no date last), then project order. */
export function sortTasks(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p) return p;
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
    return a.sort_order - b.sort_order;
  });
}

export async function loadWorkspace(supabase: SupabaseClient): Promise<Workspace> {
  const [projectsRaw, tasksRaw, settingsRes] = await Promise.all([
    fetchAll<Project>((from, to) => supabase.from("projects").select("*").order("sort_order").order("name").range(from, to)),
    fetchAll<Task>((from, to) =>
      supabase.from("tasks").select("*").order("project_id").order("sort_order").order("created_at").range(from, to),
    ),
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...(settingsRes.data ?? {}) };
  const tz = settings.timezone || DEFAULT_TZ;
  const today = todayIn(tz);
  const projects = projectsRaw.map(normaliseProject);
  return { projects, tasks: enrichTasks(tasksRaw, projects, today), settings, today, tz };
}

/** The project's next action, falling back to its first open task. */
export function projectNextAction(project: Project, tasks: TaskView[]): string | null {
  if (project.next_action?.trim()) return project.next_action;
  const first = tasks
    .filter((t) => t.project_id === project.id && t.isOpen && !t.recurring_template_id)
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return first?.title ?? null;
}

export function isActiveProject(p: Project) {
  return p.status === "IN_PROGRESS" || p.status === "PENDING" || p.status === "WAITING";
}
