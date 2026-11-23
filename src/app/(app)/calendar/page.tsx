import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { getWorkspace } from "@/lib/data/load";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendar" };

const PRIORITY_DOT: Record<string, string> = { P0: "bg-red-500", P1: "bg-orange-400", P2: "bg-slate-400", P3: "bg-slate-300" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : ws.today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday-first grid
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -lead);
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const byDate = new Map<string, typeof ws.tasks>();
  for (const t of ws.tasks) {
    if (!t.due_date || t.status === "CANCELLED") continue;
    if (t.recurring_template_id && t.status === "COMPLETED") continue;
    byDate.set(t.due_date, [...(byDate.get(t.due_date) ?? []), t]);
  }
  const deadlines = new Map<string, typeof ws.projects>();
  for (const p of ws.projects) if (p.target_date) deadlines.set(p.target_date, [...(deadlines.get(p.target_date) ?? []), p]);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Task due dates and project deadlines"
        actions={
          <>
            <Link href={`/calendar?month=${prev}`} className={buttonClass("outline", "sm")} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="w-36 text-center text-sm font-medium">{title}</span>
            <Link href={`/calendar?month=${next}`} className={buttonClass("outline", "sm")} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/calendar" className={buttonClass("ghost", "sm")}>
              Today
            </Link>
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-medium text-slate-500">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: cells }, (_, i) => {
            const date = addDays(gridStart, i);
            const inMonth = date.slice(0, 7) === month;
            const items = byDate.get(date) ?? [];
            const dl = deadlines.get(date) ?? [];
            return (
              <div key={date} className={cn("min-h-20 border-b border-r border-slate-100 p-1 sm:min-h-28 sm:p-1.5", !inMonth && "bg-slate-50/70")}>
                <p className={cn("mb-1 text-right text-[11px]", date === ws.today ? "font-bold text-brand-700" : inMonth ? "text-slate-600" : "text-slate-300")}>
                  {Number(date.slice(8))}
                </p>
                <div className="space-y-0.5">
                  {dl.map((p) => (
                    <Link key={p.id} href={`/projects/${p.slug}`} className="block truncate rounded bg-brand-50 px-1 text-[10px] font-medium text-brand-700 sm:text-[11px]">
                      ◆ {p.name}
                    </Link>
                  ))}
                  {items.slice(0, 4).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      title={`${t.title} · ${t.projectName}`}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1 text-[10px] hover:bg-slate-100 sm:text-[11px]",
                        t.status === "COMPLETED" ? "text-slate-400 line-through" : t.isOverdue ? "text-red-700" : "text-slate-700",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  ))}
                  {items.length > 4 && (
                    <Link href={`/tasks?view=all&q=`} className="block px-1 text-[10px] text-slate-500">
                      +{items.length - 4} more
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <p className="mt-2 text-xs text-slate-500">Tasks without a due date don’t appear here. ◆ = project deadline.</p>
    </>
  );
}
