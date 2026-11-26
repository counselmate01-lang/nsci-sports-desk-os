"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/form";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/types";

export interface FilterOption {
  value: string;
  label: string;
}

/** Filter dropdowns that write to the URL (?status=…), so filtered views can be bookmarked. */
export function TaskFilters({
  projects,
  people,
  waitingValues,
  showProject = true,
  showView = true,
}: {
  projects?: FilterOption[];
  people?: string[];
  waitingValues?: string[];
  showProject?: boolean;
  showView?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const cls = "h-8 w-auto min-w-0 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showView && (
        <Select aria-label="View" className={cls} value={sp.get("view") ?? ""} onChange={(e) => set("view", e.target.value)}>
          <option value="">Open tasks</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
          <option value="overdue">Overdue</option>
          <option value="waiting">Waiting for someone</option>
          <option value="blocked">Blocked by a dependency</option>
          <option value="nodate">No due date</option>
          <option value="completed">Completed</option>
          <option value="all">All tasks</option>
        </Select>
      )}
      <Select aria-label="Status" className={cls} value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">Any status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      <Select aria-label="Priority" className={cls} value={sp.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value)}>
        <option value="">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </Select>
      {showProject && projects && (
        <Select aria-label="Project" className={cls} value={sp.get("project") ?? ""} onChange={(e) => set("project", e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      )}
      {people && people.length > 0 && (
        <Select aria-label="Owner / assigned" className={cls} value={sp.get("person") ?? ""} onChange={(e) => set("person", e.target.value)}>
          <option value="">Anyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      )}
      {waitingValues && waitingValues.length > 0 && (
        <Select aria-label="Waiting for" className={cls} value={sp.get("waiting") ?? ""} onChange={(e) => set("waiting", e.target.value)}>
          <option value="">Waiting for: any</option>
          {waitingValues.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </Select>
      )}
      <Select aria-label="Due date" className={cls} value={sp.get("due") ?? ""} onChange={(e) => set("due", e.target.value)}>
        <option value="">Any due date</option>
        <option value="today">Today</option>
        <option value="7">Next 7 days</option>
        <option value="30">Next 30 days</option>
        <option value="past">Before today</option>
        <option value="none">No date</option>
      </Select>
      {sp.toString() && (
        <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => router.replace(pathname + (sp.get("tab") ? `?tab=${sp.get("tab")}` : ""), { scroll: false })}>
          Clear
        </button>
      )}
    </div>
  );
}
