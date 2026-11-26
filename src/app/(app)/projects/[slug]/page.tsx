import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, Folder } from "lucide-react";
import { Card, CardBody, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { BudgetStatusBadge, PriorityBadge, StatusBadge, Tag } from "@/components/ui/badges";
import { TaskList, TaskTable } from "@/components/tasks/task-list";
import { TaskFilters } from "@/components/tasks/task-filters";
import { ActivityList } from "@/components/activity/activity-list";
import { AddTaskButton, BudgetForm, EditProjectButton, ExpenseForm } from "@/components/projects/project-forms";
import { DeleteProjectButton } from "@/components/projects/delete-project";
import { DocumentForm, DocumentTable } from "@/components/documents/documents";
import { ReminderButton } from "@/components/reminders/reminder-form";
import { ExpenseList } from "@/components/projects/expense-list";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { filterTasks } from "@/lib/data/filter";
import { projectNextAction } from "@/lib/data/workspace";
import { dueLabel, formatDate } from "@/lib/dates";
import { driveFolderFor, DRIVE_ROOT } from "@/lib/drive";
import { cn, formatINR } from "@/lib/utils";
import type { Activity, DocumentRow, Expense } from "@/lib/types";

const TABS = ["overview", "tasks", "budget", "documents", "activity"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ws = await getWorkspace();
  return { title: ws.projects.find((p) => p.slug === slug)?.name ?? "Project" };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  const project = ws.projects.find((p) => p.slug === slug);
  if (!project) notFound();
  const canEdit = profile?.role !== "viewer";
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";

  const tasks = ws.tasks.filter((t) => t.project_id === project.id);
  const workflowTasks = tasks.filter((t) => !t.recurring_template_id).sort((a, b) => a.sort_order - b.sort_order);
  const openTasks = tasks.filter((t) => t.isOpen);
  const done = workflowTasks.filter((t) => t.status === "COMPLETED").length;
  const next = projectNextAction(project, ws.tasks);
  const taskOptions = workflowTasks.map((t) => ({ id: t.id, title: t.title }));
  const taskNames = new Map(tasks.map((t) => [t.id, t.title]));

  const [docsRes, expRes, actRes] = await Promise.all([
    supabase.from("documents").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).returns<DocumentRow[]>(),
    tab === "budget" || tab === "overview"
      ? supabase.from("expenses").select("*").eq("project_id", project.id).order("spent_on", { ascending: false }).returns<Expense[]>()
      : Promise.resolve({ data: [] as Expense[] }),
    tab === "activity" || tab === "overview"
      ? supabase
          .from("activity_log")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(tab === "activity" ? 300 : 8)
          .returns<Activity[]>()
      : Promise.resolve({ data: [] as Activity[] }),
  ]);
  const docs = docsRes.data ?? [];
  const expenses = expRes.data ?? [];
  const activity = actRes.data ?? [];
  const quotations = docs.filter((d) => d.doc_type === "QUOTATION");
  const remainingNegative = project.approved_budget !== null && project.remaining_budget < 0;

  const tabLink = (t: Tab) => `/projects/${project.slug}${t === "overview" ? "" : `?tab=${t}`}`;
  const tabLabel: Record<Tab, string> = {
    overview: "Overview",
    tasks: `Tasks (${workflowTasks.length})`,
    budget: "Budget",
    documents: `Documents (${docs.length})`,
    activity: "Activity",
  };

  return (
    <>
      <div className="mb-2 text-xs text-slate-500">
        <Link href="/projects" className="hover:text-slate-700">
          Projects
        </Link>{" "}
        / {project.name}
      </div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.name} <StatusBadge status={project.status} /> <PriorityBadge priority={project.priority} long />
          </span>
        }
        description={project.description ?? undefined}
        actions={
          canEdit && (
            <>
              <AddTaskButton projects={ws.projects.map((p) => ({ id: p.id, name: p.name }))} projectId={project.id} today={ws.today} />
              <EditProjectButton project={project} />
              <ReminderButton title={`Follow up: ${project.name}`} projectId={project.id} today={ws.today} />
            </>
          )
        }
      />

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabLink(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              tab === t ? "border-brand-700 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {tabLabel[t]}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader title="At a glance" />
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
                <Item label="Current status">
                  <StatusBadge status={project.status} />
                </Item>
                <Item label="Current stage">{project.current_stage ?? "—"}</Item>
                <Item label="Next action" wide>
                  <span className="text-base font-semibold text-slate-900">{next ?? <span className="text-red-600">No next action set</span>}</span>
                </Item>
                <Item label="Responsible (owner)">{project.owner ?? "—"}</Item>
                <Item label="Waiting for">{project.waiting_for ? <Tag tone="amber">{project.waiting_for}</Tag> : "—"}</Item>
                <Item label="Deadline">
                  {project.target_date ? `${formatDate(project.target_date)} (${dueLabel(project.target_date, ws.today)})` : "—"}
                </Item>
                <Item label="Progress">
                  {done}/{workflowTasks.length} tasks done
                </Item>
                <Item label="Documents">
                  {docs.length} attached
                  {project.drive_folder_url && (
                    <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Drive folder
                    </a>
                  )}
                </Item>
              </dl>
            </Card>
            <Card>
              <CardHeader title="Open tasks" action={<Link href={tabLink("tasks")} className="text-xs font-medium text-brand-700 hover:underline">All tasks</Link>} />
              <TaskList tasks={openTasks.sort((a, b) => a.sort_order - b.sort_order)} today={ws.today} showProject={false} canEdit={canEdit} empty="No open tasks." limit={12} />
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Budget summary" action={<BudgetStatusBadge status={project.budget_status} />} />
              <BudgetNumbers project={project} />
            </Card>
            <Card>
              <CardHeader title="Recent activity" action={<Link href={tabLink("activity")} className="text-xs font-medium text-brand-700 hover:underline">View all</Link>} />
              <ActivityList items={activity} tz={ws.tz} />
            </Card>
            {canEdit && profile?.role === "admin" && (
              <div className="text-right">
                <DeleteProjectButton id={project.id} />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <TaskFilters showProject={false} showView={false} />
          </div>
          {sp.status || sp.priority || sp.due ? (
            <TaskTable tasks={filterTasks(tasks, { view: "all", status: sp.status, priority: sp.priority, due: sp.due }, ws.today)} today={ws.today} showProject={false} canEdit={canEdit} />
          ) : (
            <TaskTable tasks={[...workflowTasks, ...tasks.filter((t) => t.recurring_template_id).sort((a, b) => (b.occurrence_date ?? "").localeCompare(a.occurrence_date ?? ""))]} today={ws.today} showProject={false} canEdit={canEdit} />
          )}
        </Card>
      )}

      {tab === "budget" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader title="Budget" action={<BudgetStatusBadge status={project.budget_status} />} />
              <BudgetNumbers project={project} />
              {remainingNegative && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                  Warning: spending is {formatINR(-project.remaining_budget)} over the approved budget.
                </p>
              )}
            </Card>
            <Card>
              <CardHeader title="Spend history" description="Actual spend = total of these entries" />
              <ExpenseList expenses={expenses} canEdit={canEdit} taskNames={taskNames} />
            </Card>
            <Card>
              <CardHeader title="Quotations" description="Mark the chosen quotation as L1 on the Documents tab" />
              {quotations.length === 0 ? (
                <Empty>No quotations attached yet.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {quotations.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span>
                        {q.title} {q.is_l1 && <Tag tone="blue">L1</Tag>}
                        <span className="block text-xs text-slate-500">{q.vendor ?? ""}</span>
                      </span>
                      <span className="tabular font-medium">{formatINR(q.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {workflowTasks.some((t) => t.estimated_budget || t.approved_budget || t.actual_spend) && (
              <Card>
                <CardHeader title="Task-level budgets" />
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Task</th>
                      <th className="px-3 py-2 text-right font-medium">Estimated</th>
                      <th className="px-3 py-2 text-right font-medium">Approved</th>
                      <th className="px-4 py-2 text-right font-medium">Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workflowTasks
                      .filter((t) => t.estimated_budget || t.approved_budget || t.actual_spend)
                      .map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2">{t.title}</td>
                          <td className="tabular px-3 py-2 text-right">{formatINR(t.estimated_budget)}</td>
                          <td className="tabular px-3 py-2 text-right">{formatINR(t.approved_budget)}</td>
                          <td className="tabular px-4 py-2 text-right">{formatINR(t.actual_spend)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
          {canEdit && (
            <div className="space-y-5">
              <Card>
                <CardHeader title="Update budget" />
                <CardBody>
                  <BudgetForm project={project} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Record spend" />
                <CardBody>
                  <ExpenseForm projectId={project.id} today={ws.today} tasks={taskOptions} />
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader title="Google Drive folder" />
              <CardBody className="text-sm">
                {project.drive_folder_url ? (
                  <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
                    <Folder className="h-4 w-4" /> Open project folder
                  </a>
                ) : (
                  <p className="text-slate-500">No folder linked yet. Use “Edit project” to paste the Drive folder link.</p>
                )}
                <DriveTree slug={project.slug} name={project.name} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Documents & quotations" />
              <DocumentTable docs={docs} canEdit={canEdit} taskNames={taskNames} />
            </Card>
          </div>
          {canEdit && (
            <Card>
              <CardHeader title="Add document" />
              <CardBody>
                <DocumentForm projectId={project.id} tasks={taskOptions} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity log" description="Every change to this project, its tasks, documents and budget" />
          <ActivityList items={activity} tz={ws.tz} />
        </Card>
      )}
    </>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function BudgetNumbers({ project }: { project: import("@/lib/types").Project }) {
  const rows: [string, number | null, string?][] = [
    ["Estimated", project.estimated_budget],
    ["Quoted", project.quoted_amount],
    ["Approved", project.approved_budget],
    ["Spent", project.actual_spend],
  ];
  return (
    <dl className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
      {rows.map(([l, v]) => (
        <div key={l} className="contents">
          <dt className="text-slate-500">{l}</dt>
          <dd className="tabular text-right font-medium">{formatINR(v)}</dd>
        </div>
      ))}
      <dt className="border-t border-slate-100 pt-2 font-medium text-slate-700">Remaining</dt>
      <dd className={cn("tabular border-t border-slate-100 pt-2 text-right font-semibold", project.remaining_budget < 0 && project.approved_budget !== null ? "text-red-600" : "text-slate-900")}>
        {project.approved_budget === null ? "—" : formatINR(project.remaining_budget)}
      </dd>
    </dl>
  );
}

function DriveTree({ slug, name }: { slug: string; name: string }) {
  const f = driveFolderFor(slug, name);
  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-600">
      <p className="mb-1 font-sans text-[11px] font-medium text-slate-500">Planned folder structure</p>
      {DRIVE_ROOT}
      <br />└── {f.folder}
      {f.subfolders.map((s, i) => (
        <span key={s}>
          <br />
          {"    "}
          {i === f.subfolders.length - 1 ? "└──" : "├──"} {s}
        </span>
      ))}
    </div>
  );
}
