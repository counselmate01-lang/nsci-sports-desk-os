import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, Empty, PageHeader, Stat } from "@/components/ui/card";
import { BudgetStatusBadge, PriorityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { TaskList } from "@/components/tasks/task-list";
import { ReminderList } from "@/components/dashboard/reminder-list";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { dashboardStats } from "@/lib/data/stats";
import { projectNextAction } from "@/lib/data/workspace";
import { dueLabel, formatDate, formatDateTime, weekdayName } from "@/lib/dates";
import { buttonClass } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import type { Reminder } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  const s = dashboardStats(ws);
  const canEdit = profile?.role !== "viewer";
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "PENDING")
    .lte("remind_at", new Date().toISOString())
    .order("remind_at")
    .limit(20)
    .returns<Reminder[]>();

  const activeProjects = s.activeProjects.filter((p) => !p.is_recurring);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${weekdayName(ws.today)}, ${formatDate(ws.today)}`}
        actions={
          <Link href="/reports" className={buttonClass("outline", "sm")}>
            Generate Manager Update
          </Link>
        }
      />

      <ReminderList
        canEdit={canEdit}
        reminders={(reminders ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          message: r.message,
          when: formatDateTime(r.remind_at, ws.tz),
          taskId: r.task_id,
          kind: r.kind,
        }))}
      />

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total projects" value={s.totalProjects} href="/projects" />
        <Stat label="Active tasks" value={s.activeTasks} href="/tasks" />
        <Stat label="Urgent (P0)" value={s.highPriority.length} href="/tasks?priority=P0" tone={s.highPriority.length ? "danger" : "default"} />
        <Stat label="Overdue" value={s.overdue.length} href="/tasks?view=overdue" tone={s.overdue.length ? "danger" : "default"} />
        <Stat label="Waiting for someone" value={s.waitingTasks.length + s.waitingProjects.length} href="/tasks?view=waiting" tone="warning" />
        <Stat label="Due today" value={s.dueToday.length} href="/tasks?view=today" />
        <Stat label="Due this week" value={s.dueThisWeek.length} href="/tasks?view=week" />
        <Stat label="Completed tasks" value={s.completedCount} href="/tasks?view=completed" tone="success" />
        <Stat label="Approved budget" value={formatINR(s.budget.totalApproved)} href="/budget" />
        <Stat label="Spent" value={formatINR(s.budget.totalSpent)} href="/budget" />
        <Stat label="Remaining" value={formatINR(s.budget.totalRemaining)} href="/budget" tone={s.budget.totalRemaining < 0 ? "danger" : "default"} />
        <Stat label="Pending approvals" value={s.pendingApprovalProjects.length} href="/budget" tone={s.pendingApprovalProjects.length ? "warning" : "default"} />
      </div>

      {s.noDueDate.length > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          {s.noDueDate.length} open tasks have no due date, so they can’t appear in “Due today” or “Overdue”.
          <Link href="/tasks?view=nodate" className="font-medium text-brand-700 hover:underline">
            Set due dates
          </Link>
        </p>
      )}

      {/* Projects: next action is the most important thing on the page */}
      <Card className="mt-5">
        <CardHeader title="Active projects – next actions" description="Status, next action, who we’re waiting for and deadline for every active project" />
        {activeProjects.length === 0 ? (
          <Empty>No active projects.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Next action</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Waiting for</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Owner</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Deadline</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeProjects.map((p) => {
                  const next = projectNextAction(p, ws.tasks);
                  return (
                    <tr key={p.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/projects/${p.slug}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {p.name}
                        </Link>
                        <div className="mt-0.5">
                          <PriorityBadge priority={p.priority} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={p.status} />
                        {p.current_stage && <p className="mt-1 text-[11px] text-slate-500">{p.current_stage}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">{next ?? <span className="text-red-600">No next action set</span>}</td>
                      <td className="hidden px-3 py-2.5 md:table-cell">{p.waiting_for ? <Tag tone="amber">{p.waiting_for}</Tag> : <span className="text-slate-400">—</span>}</td>
                      <td className="hidden px-3 py-2.5 text-xs text-slate-600 lg:table-cell">{p.owner ?? "—"}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-slate-600 sm:table-cell">{p.target_date ? dueLabel(p.target_date, ws.today) : "—"}</td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <BudgetStatusBadge status={p.budget_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Today’s priorities" description="Overdue, due today and P0 work" />
          <TaskList tasks={s.todaysPriorities} today={ws.today} canEdit={canEdit} limit={10} empty="No overdue, due-today or P0 tasks." />
        </Card>
        <Card>
          <CardHeader title="2. Overdue" />
          <TaskList tasks={s.overdue} today={ws.today} canEdit={canEdit} limit={10} empty="Nothing overdue." />
        </Card>
        <Card>
          <CardHeader title="3. Waiting for" description="Tasks and projects blocked on someone else" />
          {s.waitingProjects.length > 0 && (
            <ul className="divide-y divide-slate-100 border-b border-slate-100">
              {s.waitingProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Link href={`/projects/${p.slug}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <Tag tone="amber">{p.waiting_for}</Tag>
                </li>
              ))}
            </ul>
          )}
          <TaskList tasks={s.waitingTasks} today={ws.today} canEdit={canEdit} limit={10} empty={s.waitingProjects.length ? "No individual tasks waiting." : "Not waiting on anyone."} />
        </Card>
        <Card>
          <CardHeader title="4. Recently completed" description="Last 7 days" />
          <TaskList tasks={s.recentlyCompleted} today={ws.today} canEdit={canEdit} limit={10} empty="Nothing completed in the last 7 days." />
        </Card>
        <Card>
          <CardHeader title="5. Upcoming" description="Due in the next 14 days" />
          <TaskList tasks={s.upcoming} today={ws.today} canEdit={canEdit} limit={10} empty="No upcoming due dates." />
        </Card>
        <Card>
          <CardHeader title="6. Budget summary" action={<Link href="/budget" className="text-xs font-medium text-brand-700 hover:underline">Open budget</Link>} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-sm">
            <dt className="text-slate-500">Total approved</dt>
            <dd className="tabular text-right font-medium">{formatINR(s.budget.totalApproved)}</dd>
            <dt className="text-slate-500">Total spent</dt>
            <dd className="tabular text-right font-medium">{formatINR(s.budget.totalSpent)}</dd>
            <dt className="text-slate-500">Remaining</dt>
            <dd className={`tabular text-right font-medium ${s.budget.totalRemaining < 0 ? "text-red-600" : ""}`}>{formatINR(s.budget.totalRemaining)}</dd>
            <dt className="text-slate-500">Pending approval</dt>
            <dd className="tabular text-right font-medium">
              {formatINR(s.budget.pendingApprovalAmount)} <span className="text-xs text-slate-500">({s.pendingApprovalProjects.length})</span>
            </dd>
          </dl>
          {s.budget.overBudget.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-red-700">
              Over budget: {s.budget.overBudget.map((p) => p.name).join(", ")}
            </div>
          )}
          {s.budget.totalApproved === 0 && s.budget.totalSpent === 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">No budgets recorded yet. Add them on each project’s Budget tab.</p>
          )}
        </Card>
      </div>
    </>
  );
}
