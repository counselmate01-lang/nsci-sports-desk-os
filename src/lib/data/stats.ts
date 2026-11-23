import { addDays } from "@/lib/dates";
import { num } from "@/lib/utils";
import { isActiveProject, sortTasks, type Workspace } from "./workspace";

export function dashboardStats(ws: Workspace) {
  const { tasks, projects, today } = ws;
  const open = tasks.filter((t) => t.isOpen);
  const weekEnd = addDays(today, 6);
  const sevenDaysAgo = addDays(today, -7);

  const overdue = sortTasks(open.filter((t) => t.isOverdue));
  const dueToday = sortTasks(open.filter((t) => t.isDueToday));
  const dueThisWeek = sortTasks(open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd));
  const waitingTasks = sortTasks(open.filter((t) => t.isWaiting));
  const highPriority = sortTasks(open.filter((t) => t.priority === "P0"));
  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const recentlyCompleted = completed
    .filter((t) => t.completed_at && t.completed_at.slice(0, 10) >= sevenDaysAgo)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const upcoming = sortTasks(open.filter((t) => t.due_date && t.due_date > today && t.due_date <= addDays(today, 14)))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const noDueDate = open.filter((t) => !t.due_date && !t.recurring_template_id);

  // Today's priorities: overdue, due today, then P0 work, without duplicates.
  const seen = new Set<string>();
  const todaysPriorities = [...overdue, ...dueToday, ...highPriority].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const waitingProjects = projects.filter((p) => isActiveProject(p) && p.waiting_for?.trim());
  const pendingApprovalProjects = projects.filter((p) => p.budget_status === "PENDING_APPROVAL");

  const totalApproved = projects.reduce((s, p) => s + num(p.approved_budget), 0);
  const totalSpent = projects.reduce((s, p) => s + num(p.actual_spend), 0);
  const totalEstimated = projects.reduce((s, p) => s + num(p.estimated_budget), 0);
  const pendingApprovalAmount = pendingApprovalProjects.reduce(
    (s, p) => s + num(p.quoted_amount ?? p.estimated_budget),
    0,
  );
  const overBudget = projects.filter((p) => p.approved_budget !== null && p.remaining_budget < 0);

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter(isActiveProject),
    activeTasks: open.length,
    highPriority,
    overdue,
    dueToday,
    dueThisWeek,
    waitingTasks,
    waitingProjects,
    completedCount: completed.length,
    recentlyCompleted,
    upcoming,
    noDueDate,
    todaysPriorities,
    pendingApprovalProjects,
    budget: {
      totalApproved,
      totalSpent,
      totalRemaining: totalApproved - totalSpent,
      totalEstimated,
      pendingApprovalAmount,
      overBudget,
    },
  };
}

export type DashboardStats = ReturnType<typeof dashboardStats>;
