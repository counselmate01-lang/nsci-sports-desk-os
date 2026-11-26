import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PriorityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { ActivityList } from "@/components/activity/activity-list";
import { Checklist, TaskEditForm } from "@/components/tasks/task-edit-form";
import { DocumentForm, DocumentTable } from "@/components/documents/documents";
import { ReminderButton } from "@/components/reminders/reminder-form";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { dueLabel, formatDateTime } from "@/lib/dates";
import type { Activity, DocumentRow, Reminder } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ws = await getWorkspace();
  return { title: ws.tasks.find((t) => t.id === id)?.title ?? "Task" };
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  const task = ws.tasks.find((t) => t.id === id);
  if (!task) notFound();
  const canEdit = profile?.role !== "viewer";
  const siblings = ws.tasks
    .filter((t) => t.project_id === task.project_id && !t.recurring_template_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({ id: t.id, title: t.title }));
  const dependents = ws.tasks.filter((t) => t.depends_on_task_id === task.id);

  const [actRes, docRes, remRes] = await Promise.all([
    supabase.from("activity_log").select("*").eq("task_id", task.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100).returns<Activity[]>(),
    supabase.from("documents").select("*").eq("task_id", task.id).order("created_at", { ascending: false }).returns<DocumentRow[]>(),
    supabase.from("reminders").select("*").eq("task_id", task.id).eq("status", "PENDING").order("remind_at").returns<Reminder[]>(),
  ]);

  return (
    <>
      <div className="mb-2 text-xs text-slate-500">
        <Link href="/tasks" className="hover:text-slate-700">
          Tasks
        </Link>{" "}
        /{" "}
        <Link href={`/projects/${task.projectSlug}?tab=tasks`} className="hover:text-slate-700">
          {task.projectName}
        </Link>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} long />
            <span className={task.isOverdue ? "font-medium text-red-600" : "text-slate-500"}>{dueLabel(task.due_date, ws.today)}</span>
            {task.waiting_for && (
              <Tag tone="amber">
                Waiting: {task.waiting_for}
                {task.waitingDays ? ` · ${task.waitingDays}d` : ""}
              </Tag>
            )}
            {task.blockedBy && (
              <Link href={`/tasks/${task.blockedBy.id}`}>
                <Tag>Blocked by: {task.blockedBy.title}</Tag>
              </Link>
            )}
          </div>
        </div>
        {canEdit && <ReminderButton title={task.title} taskId={task.id} projectId={task.project_id} today={ws.today} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {task.checklist.length > 0 && (
            <Card>
              <CardHeader title="Checklist" description={`${task.checklist.filter((c) => c.done).length} of ${task.checklist.length} done`} />
              <CardBody>
                <Checklist taskId={task.id} items={task.checklist} canEdit={canEdit} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <TaskEditForm task={task} projects={ws.projects.map((p) => ({ id: p.id, name: p.name }))} siblingTasks={siblings} canEdit={canEdit} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          {dependents.length > 0 && (
            <Card>
              <CardHeader title="Waiting on this task" />
              <ul className="divide-y divide-slate-100">
                {dependents.map((d) => (
                  <li key={d.id} className="px-4 py-2">
                    <Link href={`/tasks/${d.id}`} className="text-sm text-slate-800 hover:text-brand-700">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(remRes.data ?? []).length > 0 && (
            <Card>
              <CardHeader title="Reminders" />
              <ul className="divide-y divide-slate-100">
                {remRes.data!.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-sm">
                    {r.title}
                    <span className="block text-xs text-slate-500">{formatDateTime(r.remind_at, ws.tz)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Attachments" />
            <DocumentTable docs={docRes.data ?? []} canEdit={canEdit} />
            {canEdit && (
              <details className="border-t border-slate-100 px-4 py-3">
                <summary className="cursor-pointer text-xs font-medium text-brand-700">Attach a link or file</summary>
                <div className="mt-3">
                  <DocumentForm projectId={task.project_id} taskId={task.id} />
                </div>
              </details>
            )}
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <ActivityList items={actRes.data ?? []} tz={ws.tz} />
          </Card>
        </div>
      </div>
    </>
  );
}
