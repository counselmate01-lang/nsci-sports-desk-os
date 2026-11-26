import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { TaskTable } from "@/components/tasks/task-list";
import { TaskFilters } from "@/components/tasks/task-filters";
import { AddTaskButton } from "@/components/projects/project-forms";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { distinctPeople, distinctWaiting, filterTasks } from "@/lib/data/filter";

export const metadata: Metadata = { title: "Tasks" };

const VIEW_TITLE: Record<string, string> = {
  today: "Due today",
  week: "Due this week",
  overdue: "Overdue",
  waiting: "Waiting for someone",
  blocked: "Blocked by a dependency",
  nodate: "Open tasks with no due date",
  completed: "Completed",
  all: "All tasks",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await requireUser();
  const ws = await getWorkspace();
  const tasks = filterTasks(ws.tasks, sp, ws.today);
  const canEdit = profile?.role !== "viewer";

  return (
    <>
      <PageHeader
        title={VIEW_TITLE[sp.view ?? ""] ?? "Open tasks"}
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"}. Change status inline, or open a task to edit everything.`}
        actions={canEdit && <AddTaskButton projects={ws.projects.map((p) => ({ id: p.id, name: p.name }))} today={ws.today} label="New task" />}
      />
      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <Suspense>
            <TaskFilters
              projects={ws.projects.map((p) => ({ value: p.slug, label: p.name }))}
              people={distinctPeople(ws.tasks)}
              waitingValues={distinctWaiting(ws.tasks)}
            />
          </Suspense>
        </div>
        <TaskTable tasks={tasks} today={ws.today} canEdit={canEdit} />
      </Card>
    </>
  );
}
