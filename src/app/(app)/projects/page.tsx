import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { BudgetStatusBadge, PriorityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { NewProjectButton } from "@/components/projects/project-forms";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { projectNextAction } from "@/lib/data/workspace";
import { dueLabel } from "@/lib/dates";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

const ORDER: Record<string, number> = { IN_PROGRESS: 0, PENDING: 1, WAITING: 2, TBD: 3, COMPLETED: 4, CANCELLED: 5 };

export default async function ProjectsPage() {
  const { profile } = await requireUser();
  const ws = await getWorkspace();
  const projects = [...ws.projects].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.priority.localeCompare(b.priority) || a.sort_order - b.sort_order);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project answers: status, next action, who is responsible, who we’re waiting for, deadline and budget."
        actions={profile?.role !== "viewer" && <NewProjectButton />}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const tasks = ws.tasks.filter((t) => t.project_id === p.id && !t.recurring_template_id);
          const done = tasks.filter((t) => t.status === "COMPLETED").length;
          const overdue = tasks.filter((t) => t.isOverdue).length;
          const next = projectNextAction(p, ws.tasks);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{p.name}</h2>
                <PriorityBadge priority={p.priority} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={p.status} />
                {p.current_stage && <span className="text-xs text-slate-500">{p.current_stage}</span>}
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-slate-500">Next action</dt>
                  <dd className="font-medium text-slate-800">{next ?? <span className="text-red-600">Not set</span>}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-slate-500">Waiting for</dt>
                  <dd>{p.waiting_for ? <Tag tone="amber">{p.waiting_for}</Tag> : <span className="text-slate-400">—</span>}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-slate-500">Owner</dt>
                  <dd className="text-slate-700">{p.owner ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-slate-500">Deadline</dt>
                  <dd className="text-slate-700">{p.target_date ? dueLabel(p.target_date, ws.today) : "—"}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-slate-500">Budget</dt>
                  <dd className="flex items-center gap-1.5 text-slate-700">
                    <BudgetStatusBadge status={p.budget_status} />
                    {p.approved_budget !== null && <span className="tabular">{formatINR(p.approved_budget)}</span>}
                  </dd>
                </div>
              </dl>
              <div className="mt-auto pt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {p.is_recurring ? "Recurring checklist" : `${done}/${tasks.length} tasks done`}
                  {overdue > 0 && <span className="ml-2 font-medium text-red-600">{overdue} overdue</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
