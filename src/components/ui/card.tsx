import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs text-slate-500">{children}</p>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-slate-900",
    danger: "text-red-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
  }[tone];
  const inner = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-semibold", toneClass)}>{value}</p>
    </>
  );
  const cls = "block rounded-lg border border-slate-200 bg-white px-4 py-3";
  return href ? (
    <a href={href} className={cn(cls, "hover:border-slate-300 hover:bg-slate-50")}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
