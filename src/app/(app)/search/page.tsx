import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { StatusBadge, Tag } from "@/components/ui/badges";
import { TaskList } from "@/components/tasks/task-list";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { sortTasks } from "@/lib/data/workspace";
import { STATUS_LABEL, type DocumentRow } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = "" } = await searchParams;
  const q = raw.trim().slice(0, 100);
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  const needle = q.toLowerCase();
  const has = (v: string | null | undefined) => Boolean(v && v.toLowerCase().includes(needle));

  // Status words ("waiting", "in progress", "tbd") also match
  const statusHit = Object.entries(STATUS_LABEL).find(([k, label]) => needle && (k.toLowerCase() === needle.replace(/\s/g, "_") || label.toLowerCase() === needle))?.[0];

  const projects = q
    ? ws.projects.filter((p) => has(p.name) || has(p.description) || has(p.owner) || has(p.waiting_for) || has(p.next_action) || has(p.current_stage) || p.aliases.some(has) || p.status === statusHit)
    : [];
  const tasks = q
    ? sortTasks(
        ws.tasks.filter(
          (t) =>
            has(t.title) || has(t.description) || has(t.notes) || has(t.owner) || has(t.assigned_to) || has(t.waiting_for) || has(t.dependency) || t.status === statusHit,
        ),
      )
    : [];

  const people = new Map<string, { tasks: number; waiting: number }>();
  if (q) {
    for (const t of ws.tasks.filter((t) => t.isOpen)) {
      for (const v of [t.owner, t.assigned_to]) {
        if (v && has(v)) people.set(v, { tasks: (people.get(v)?.tasks ?? 0) + 1, waiting: people.get(v)?.waiting ?? 0 });
      }
      if (t.waiting_for && has(t.waiting_for)) {
        const v = t.waiting_for;
        people.set(v, { tasks: people.get(v)?.tasks ?? 0, waiting: (people.get(v)?.waiting ?? 0) + 1 });
      }
    }
  }

  let docs: DocumentRow[] = [];
  if (q) {
    const pattern = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data } = await supabase
      .from("documents")
      .select("*")
      .or(`title.ilike.${pattern},notes.ilike.${pattern},vendor.ilike.${pattern}`)
      .limit(30)
      .returns<DocumentRow[]>();
    docs = data ?? [];
  }
  const projectName = new Map(ws.projects.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader title={q ? `Search: “${q}”` : "Search"} description="Searches projects, tasks, people, notes, statuses, waiting-for values and documents." />
      {!q ? (
        <Card>
          <Empty>Type in the search box at the top of the page.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={`Tasks (${tasks.length})`} />
            <TaskList tasks={tasks} today={ws.today} canEdit={profile?.role !== "viewer"} empty="No matching tasks." limit={50} />
          </Card>
          <div className="space-y-5">
            <Card>
              <CardHeader title={`Projects (${projects.length})`} />
              {projects.length === 0 ? (
                <Empty>No matching projects.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <Link href={`/projects/${p.slug}`} className="font-medium hover:text-brand-700">
                        {p.name}
                      </Link>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title={`People (${people.size})`} />
              {people.size === 0 ? (
                <Empty>No matching people.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...people.entries()].map(([name, c]) => (
                    <li key={name} className="px-4 py-2.5">
                      <Link href={`/tasks?q=${encodeURIComponent(name)}&view=all`} className="font-medium hover:text-brand-700">
                        {name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {c.tasks} open task(s) assigned/owned{c.waiting ? ` · waiting on them for ${c.waiting}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title={`Documents (${docs.length})`} />
              {docs.length === 0 ? (
                <Empty>No matching documents.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {docs.map((d) => {
                    const p = projectName.get(d.project_id);
                    return (
                      <li key={d.id} className="px-4 py-2.5">
                        <Link href={`/projects/${p?.slug}?tab=documents`} className="font-medium hover:text-brand-700">
                          {d.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {p?.name} {d.is_l1 && <Tag tone="blue">L1</Tag>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
