import { addDays } from "@/lib/dates";
import { sortTasks } from "./workspace";
import type { TaskView } from "@/lib/types";

export interface TaskFilterParams {
  view?: string;
  status?: string;
  priority?: string;
  project?: string; // slug
  person?: string;
  waiting?: string;
  due?: string;
  q?: string;
}

/** Applies the Tasks page filters. Used by the UI and by the AI assistant. */
export function filterTasks(tasks: TaskView[], f: TaskFilterParams, today: string): TaskView[] {
  let out = tasks;
  const view = f.view ?? "";
  switch (view) {
    case "today":
      out = out.filter((t) => t.isDueToday);
      break;
    case "week":
      out = out.filter((t) => t.isOpen && t.due_date && t.due_date >= today && t.due_date <= addDays(today, 6));
      break;
    case "overdue":
      out = out.filter((t) => t.isOverdue);
      break;
    case "waiting":
      out = out.filter((t) => t.isWaiting);
      break;
    case "blocked":
      out = out.filter((t) => t.blockedBy);
      break;
    case "nodate":
      out = out.filter((t) => t.isOpen && !t.due_date);
      break;
    case "completed":
      out = out.filter((t) => t.status === "COMPLETED");
      break;
    case "all":
      break;
    default:
      // "Open" = not completed/cancelled. TBD tasks are shown when explicitly filtered.
      if (!f.status) out = out.filter((t) => t.isOpen);
  }
  if (f.status) out = out.filter((t) => t.status === f.status);
  if (f.priority) out = out.filter((t) => t.priority === f.priority);
  if (f.project) out = out.filter((t) => t.projectSlug === f.project);
  if (f.person) {
    const p = f.person.toLowerCase();
    out = out.filter((t) => [t.owner, t.assigned_to].some((v) => v?.toLowerCase() === p));
  }
  if (f.waiting) {
    const w = f.waiting.toLowerCase();
    out = out.filter((t) => t.waiting_for?.toLowerCase().includes(w));
  }
  if (f.due) {
    if (f.due === "today") out = out.filter((t) => t.due_date === today);
    else if (f.due === "past") out = out.filter((t) => t.due_date && t.due_date < today);
    else if (f.due === "none") out = out.filter((t) => !t.due_date);
    else if (/^\d+$/.test(f.due)) {
      const end = addDays(today, Number(f.due));
      out = out.filter((t) => t.due_date && t.due_date >= today && t.due_date <= end);
    }
  }
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter((t) =>
      [t.title, t.description, t.notes, t.waiting_for, t.assigned_to, t.owner, t.dependency, t.projectName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }
  return view === "completed"
    ? [...out].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    : sortTasks(out);
}

export function distinctPeople(tasks: TaskView[]): string[] {
  const s = new Set<string>();
  for (const t of tasks) for (const v of [t.owner, t.assigned_to]) if (v?.trim()) s.add(v.trim());
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function distinctWaiting(tasks: TaskView[], projects: { waiting_for: string | null }[] = []): string[] {
  const s = new Set<string>();
  for (const t of tasks) if (t.isOpen && t.waiting_for?.trim()) s.add(t.waiting_for.trim());
  for (const p of projects) if (p.waiting_for?.trim()) s.add(p.waiting_for.trim());
  return [...s].sort((a, b) => a.localeCompare(b));
}
