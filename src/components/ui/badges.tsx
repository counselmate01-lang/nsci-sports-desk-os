import { cn } from "@/lib/utils";
import { BUDGET_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL, type BudgetStatus, type Priority, type Status } from "@/lib/types";

const base = "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap";

const statusTone: Record<Status, string> = {
  PENDING: "bg-slate-50 text-slate-700 ring-slate-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-200",
  WAITING: "bg-amber-50 text-amber-800 ring-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-50 text-slate-400 ring-slate-200 line-through",
  TBD: "bg-violet-50 text-violet-700 ring-violet-200",
};

const priorityTone: Record<Priority, string> = {
  P0: "bg-red-50 text-red-700 ring-red-200",
  P1: "bg-orange-50 text-orange-700 ring-orange-200",
  P2: "bg-slate-50 text-slate-600 ring-slate-200",
  P3: "bg-slate-50 text-slate-400 ring-slate-200",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={cn(base, statusTone[status])}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority, long }: { priority: Priority; long?: boolean }) {
  return (
    <span className={cn(base, priorityTone[priority])} title={PRIORITY_LABEL[priority]}>
      {long ? PRIORITY_LABEL[priority] : priority}
    </span>
  );
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const tone =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "PENDING_APPROVAL"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : status === "REJECTED"
          ? "bg-red-50 text-red-700 ring-red-200"
          : "bg-slate-50 text-slate-600 ring-slate-200";
  return <span className={cn(base, tone)}>{BUDGET_STATUS_LABEL[status]}</span>;
}

export function Tag({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" | "red" | "blue" }) {
  const t = {
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  }[tone];
  return <span className={cn(base, t)}>{children}</span>;
}
