import Link from "next/link";
import { Empty } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import type { Activity } from "@/lib/types";

const FIELD_FORMAT: Record<string, (v: string) => string> = {
  status: (v) => v.replace("_", " "),
  budget_status: (v) => v.replace("_", " "),
};

function fmt(field: string | null, v: string | null) {
  if (v === null || v === "") return "—";
  const f = field ? FIELD_FORMAT[field] : undefined;
  return f ? f(v) : v;
}

export function ActivityList({
  items,
  tz,
  showProject,
  projectNames,
}: {
  items: Activity[];
  tz: string;
  showProject?: boolean;
  projectNames?: Map<string, { name: string; slug: string }>;
}) {
  if (!items.length) return <Empty>No activity yet.</Empty>;
  return (
    <ol className="divide-y divide-slate-100">
      {items.map((a) => {
        const proj = a.project_id ? projectNames?.get(a.project_id) : undefined;
        const showValues = a.field && (a.previous_value !== null || a.new_value !== null) && a.field !== "is_l1";
        return (
          <li key={a.id} className="flex gap-3 px-4 py-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900">
                <span className="font-medium">{a.action}</span>
                {a.entity_title && a.entity_type !== "project" && (
                  <>
                    {" · "}
                    {a.task_id && a.entity_type === "task" ? (
                      <Link href={`/tasks/${a.task_id}`} className="text-slate-700 hover:text-brand-700">
                        {a.entity_title}
                      </Link>
                    ) : (
                      <span className="text-slate-700">{a.entity_title}</span>
                    )}
                  </>
                )}
                {a.field === "is_l1" && a.new_value && <span className="text-slate-700"> · {a.new_value}</span>}
              </p>
              {showValues && (
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="line-through decoration-slate-300">{fmt(a.field, a.previous_value)}</span>
                  {" → "}
                  <span className="text-slate-700">{fmt(a.field, a.new_value)}</span>
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400">
                {a.actor_name} · {formatDateTime(a.created_at, tz)}
                {showProject && proj && (
                  <>
                    {" · "}
                    <Link href={`/projects/${proj.slug}?tab=activity`} className="hover:text-slate-600">
                      {proj.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
