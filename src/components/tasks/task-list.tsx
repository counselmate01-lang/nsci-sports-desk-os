import Link from "next/link";
import { Link2, Clock } from "lucide-react";
import { PriorityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { Empty } from "@/components/ui/card";
import { CompleteButton, TaskStatusSelect } from "./task-controls";
import { dueLabel, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskView } from "@/lib/types";

/** Compact list used on the dashboard. */
export function TaskList({
  tasks,
  today,
  empty = "Nothing here.",
  showProject = true,
  canEdit = true,
  limit,
}: {
  tasks: TaskView[];
  today: string;
  empty?: string;
  showProject?: boolean;
  canEdit?: boolean;
  limit?: number;
}) {
  if (!tasks.length) return <Empty>{empty}</Empty>;
  const shown = limit ? tasks.slice(0, limit) : tasks;
  return (
    <ul className="divide-y divide-slate-100">
      {shown.map((t) => (
        <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
          <span className="mt-0.5">
            <CompleteButton taskId={t.id} done={t.status === "COMPLETED"} disabled={!canEdit} />
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${t.id}`} className={cn("font-medium text-slate-900 hover:text-brand-700", t.status === "COMPLETED" && "text-slate-500 line-through")}>
              {t.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              {showProject && (
                <Link href={`/projects/${t.projectSlug}`} className="hover:text-slate-700">
                  {t.projectName}
                </Link>
              )}
              {t.waiting_for && <Tag tone="amber">Waiting: {t.waiting_for}</Tag>}
              {t.blockedBy && <Tag tone="slate">Blocked by: {t.blockedBy.title}</Tag>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <PriorityBadge priority={t.priority} />
            <span className={cn("text-[11px]", t.isOverdue ? "font-medium text-red-600" : "text-slate-500")}>
              {t.status === "COMPLETED" && t.completed_at ? `Done ${formatDate(t.completed_at.slice(0, 10), today)}` : dueLabel(t.due_date, today)}
            </span>
          </div>
        </li>
      ))}
      {limit && tasks.length > limit && (
        <li className="px-4 py-2 text-xs text-slate-500">+ {tasks.length - limit} more</li>
      )}
    </ul>
  );
}

/** Full table used on the Tasks page and the project Tasks tab. */
export function TaskTable({
  tasks,
  today,
  showProject = true,
  canEdit = true,
}: {
  tasks: TaskView[];
  today: string;
  showProject?: boolean;
  canEdit?: boolean;
}) {
  if (!tasks.length) return <Empty>No tasks match these filters.</Empty>;
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Task</th>
              {showProject && <th className="px-3 py-2 font-medium">Project</th>}
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Waiting for / dependency</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <tr key={t.id} className="align-top hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <CompleteButton taskId={t.id} done={t.status === "COMPLETED"} disabled={!canEdit} />
                </td>
                <td className="max-w-xs px-3 py-2.5">
                  <Link href={`/tasks/${t.id}`} className={cn("font-medium text-slate-900 hover:text-brand-700", t.status === "COMPLETED" && "text-slate-500 line-through")}>
                    {t.title}
                  </Link>
                  {t.checklist.length > 0 && (
                    <span className="ml-2 text-[11px] text-slate-500">
                      {t.checklist.filter((c) => c.done).length}/{t.checklist.length} checked
                    </span>
                  )}
                  {t.recurring_template_id && (
                    <span className="ml-1 inline-flex align-middle text-slate-400" title="Recurring">
                      <Clock className="h-3 w-3" />
                    </span>
                  )}
                </td>
                {showProject && (
                  <td className="px-3 py-2.5 text-xs">
                    <Link href={`/projects/${t.projectSlug}`} className="text-slate-600 hover:text-brand-700">
                      {t.projectName}
                    </Link>
                  </td>
                )}
                <td className="px-3 py-2.5">
                  {canEdit ? <TaskStatusSelect taskId={t.id} status={t.status} /> : <StatusBadge status={t.status} />}
                </td>
                <td className="px-3 py-2.5">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className={cn("whitespace-nowrap px-3 py-2.5 text-xs", t.isOverdue ? "font-medium text-red-600" : "text-slate-600")}>
                  {t.due_date ? dueLabel(t.due_date, today) : "—"}
                </td>
                <td className="max-w-[14rem] px-3 py-2.5 text-xs text-slate-600">
                  <div className="flex flex-col gap-1">
                    {t.waiting_for && (
                      <span>
                        <Tag tone="amber">{t.waiting_for}</Tag>
                        {t.waitingDays ? <span className="ml-1 text-[11px] text-slate-500">{t.waitingDays}d</span> : null}
                      </span>
                    )}
                    {t.blockedBy && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Link2 className="h-3 w-3" /> {t.blockedBy.title}
                      </span>
                    )}
                    {t.dependency && !t.blockedBy && <span className="text-slate-500">{t.dependency}</span>}
                    {!t.waiting_for && !t.blockedBy && !t.dependency && "—"}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{t.assigned_to ?? t.owner ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden">
        <TaskList tasks={tasks} today={today} showProject={showProject} canEdit={canEdit} />
      </div>
    </>
  );
}
