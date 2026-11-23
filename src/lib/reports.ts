import { addDays, formatDate, weekdayName } from "@/lib/dates";
import { dashboardStats } from "@/lib/data/stats";
import { isActiveProject, projectNextAction, sortTasks, type Workspace } from "@/lib/data/workspace";
import { formatINR } from "@/lib/utils";
import type { TaskView } from "@/lib/types";

// Every report is built only from database rows. Nothing is invented:
// a section with no data says "None".

const bullet = (s: string) => `• ${s}`;
const none = "• None";

function section(title: string, lines: string[], max = 12): string {
  const shown = lines.slice(0, max);
  const more = lines.length > max ? [`• …and ${lines.length - max} more`] : [];
  return `${title}:\n${shown.length ? [...shown, ...more].join("\n") : none}`;
}

function taskLine(t: TaskView, today: string, opts: { project?: boolean; due?: boolean } = { project: true }) {
  const bits = [t.title];
  if (opts.project !== false) bits.push(`(${t.projectName})`);
  if (opts.due && t.due_date) bits.push(`– due ${formatDate(t.due_date, today)}`);
  return bullet(bits.join(" "));
}

export type ReportKind = "DAILY" | "WEEKLY";

export function buildManagerUpdate(ws: Workspace, kind: ReportKind = "DAILY"): { title: string; content: string } {
  const { today, projects, tasks } = ws;
  const s = dashboardStats(ws);
  const since = kind === "DAILY" ? addDays(today, -1) : addDays(today, -7);
  const title = `NSCI Sports Desk – ${kind === "DAILY" ? "Daily" : "Weekly"} Update (${weekdayName(today)}, ${formatDate(today)})`;

  const completed = tasks
    .filter((t) => t.status === "COMPLETED" && t.completed_at && t.completed_at.slice(0, 10) >= since)
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))
    .map((t) => taskLine(t, today));

  const activeProjects = projects.filter((p) => !p.is_recurring);
  const inProgress = activeProjects
    .filter((p) => p.status === "IN_PROGRESS")
    .map((p) => {
      const next = projectNextAction(p, tasks);
      return bullet(`${p.name}${next ? ` – next: ${next}` : ""}`);
    });
  const pending = activeProjects
    .filter((p) => p.status === "PENDING")
    .map((p) => {
      const next = projectNextAction(p, tasks);
      return bullet(`${p.name} (${p.priority})${next ? ` – next: ${next}` : ""}`);
    });

  const waitingLines: string[] = [];
  for (const p of s.waitingProjects) waitingLines.push(bullet(`${p.name} – ${p.waiting_for}`));
  for (const t of s.waitingTasks) {
    if (t.waiting_for?.trim()) {
      const days = t.waitingDays ? ` (${t.waitingDays}d)` : "";
      waitingLines.push(bullet(`${t.projectName}: ${t.title} – ${t.waiting_for}${days}`));
    } else {
      waitingLines.push(bullet(`${t.projectName}: ${t.title}`));
    }
  }
  for (const p of s.pendingApprovalProjects) waitingLines.push(bullet(`${p.name} – budget approval`));

  const overdue = s.overdue.map((t) => taskLine(t, today, { project: true, due: true }));
  const upcoming = sortTasks(tasks.filter((t) => t.isOpen && !t.recurring_template_id && t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7)))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map((t) => taskLine(t, today, { project: true, due: true }));

  const b = s.budget;
  const budget: string[] = [];
  if (b.totalApproved || b.totalSpent) {
    budget.push(bullet(`Approved ${formatINR(b.totalApproved)} · Spent ${formatINR(b.totalSpent)} · Remaining ${formatINR(b.totalRemaining)}`));
  }
  for (const p of s.pendingApprovalProjects) {
    const amt = p.quoted_amount ?? p.estimated_budget;
    budget.push(bullet(`${p.name}: awaiting approval${amt ? ` for ${formatINR(amt)}` : ""}`));
  }
  for (const p of b.overBudget) budget.push(bullet(`${p.name}: over budget by ${formatINR(-p.remaining_budget)}`));

  // Blockers: urgent work that is stuck, not the normal "step 2 waits for step 1" order.
  const blockers: string[] = [];
  for (const t of tasks.filter((t) => t.isOpen && (t.priority === "P0" || t.priority === "P1") && t.isOverdue)) {
    blockers.push(bullet(`${t.projectName}: ${t.title} – overdue`));
  }
  for (const t of tasks.filter((t) => t.isOpen && t.priority === "P0" && t.isWaiting && !t.isOverdue)) {
    blockers.push(bullet(`${t.projectName}: ${t.title} – waiting for ${t.waiting_for ?? "response"}`));
  }
  for (const p of activeProjects.filter((p) => isActiveProject(p) && p.waiting_for?.trim() && p.priority !== "P3")) {
    blockers.push(bullet(`${p.name}: depends on ${p.waiting_for}`));
  }
  for (const p of s.pendingApprovalProjects) blockers.push(bullet(`${p.name}: budget approval pending`));

  const tbd = activeProjects.filter((p) => p.status === "TBD").map((p) => bullet(`${p.name} – to be confirmed`));

  const parts = [
    title,
    section("Completed", completed),
    section("In Progress", inProgress),
    section("Pending", pending),
    section("Waiting For", waitingLines),
    section("Overdue", overdue),
    section("Upcoming (next 7 days)", upcoming),
    budget.length ? section("Budget Highlights", budget) : "Budget Highlights:\n• No budgets recorded yet",
    section("Important Blockers", blockers),
  ];
  if (tbd.length) parts.push(section("On Hold / TBD", tbd));
  return { title, content: parts.join("\n\n") };
}

/** 9:00 AM digest: P0, due today, overdue, important waiting. */
export function buildMorningDigest(ws: Workspace): { title: string; content: string } {
  const s = dashboardStats(ws);
  const { today } = ws;
  const followDays = ws.settings.waiting_followup_days;
  const title = `Good morning – Sports Desk plan for ${weekdayName(today)}, ${formatDate(today)}`;
  const importantWaiting = s.waitingTasks.filter(
    (t) => t.priority === "P0" || t.priority === "P1" || (t.waitingDays ?? 0) >= followDays,
  );
  const content = [
    title,
    section("P0 (urgent)", s.highPriority.map((t) => taskLine(t, today, { project: true, due: true }))),
    section("Due today", s.dueToday.map((t) => taskLine(t, today))),
    section("Overdue", s.overdue.map((t) => taskLine(t, today, { project: true, due: true }))),
    section(
      "Waiting – follow up",
      importantWaiting.map((t) =>
        bullet(`${t.projectName}: ${t.title}${t.waiting_for ? ` – ${t.waiting_for}` : ""}${t.waitingDays ? ` (${t.waitingDays}d)` : ""}`),
      ),
    ),
  ].join("\n\n");
  return { title, content };
}

/** 6:30 PM digest: completed today, still pending, overdue, carry-forward. */
export function buildEveningDigest(ws: Workspace): { title: string; content: string } {
  const s = dashboardStats(ws);
  const { today, tasks } = ws;
  const title = `End of day – Sports Desk summary for ${formatDate(today)}`;
  const completedToday = tasks.filter((t) => t.status === "COMPLETED" && t.completed_at && isSameLocalDay(t.completed_at, today, ws.tz));
  const carry = s.dueToday; // due today and still open -> carries to tomorrow
  const stillPending = s.highPriority.filter((t) => !t.isDueToday && !t.isOverdue);
  const content = [
    title,
    section("Completed today", completedToday.map((t) => taskLine(t, today))),
    section("Still pending (P0)", stillPending.map((t) => taskLine(t, today))),
    section("Overdue", s.overdue.map((t) => taskLine(t, today, { project: true, due: true }))),
    section("Carry forward to tomorrow", carry.map((t) => taskLine(t, today))),
  ].join("\n\n");
  return { title, content };
}

function isSameLocalDay(isoTs: string, today: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(isoTs)) === today;
}
