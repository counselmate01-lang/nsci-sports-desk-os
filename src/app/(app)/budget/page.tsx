import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui/card";
import { BudgetStatusBadge } from "@/components/ui/badges";
import { getWorkspace } from "@/lib/data/load";
import { dashboardStats } from "@/lib/data/stats";
import { cn, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const ws = await getWorkspace();
  const s = dashboardStats(ws);
  const projects = ws.projects.filter((p) => !p.is_recurring || p.approved_budget || p.actual_spend);
  const totals = projects.reduce(
    (a, p) => ({
      est: a.est + (p.estimated_budget ?? 0),
      quote: a.quote + (p.quoted_amount ?? 0),
      appr: a.appr + (p.approved_budget ?? 0),
      spent: a.spent + p.actual_spend,
    }),
    { est: 0, quote: 0, appr: 0, spent: 0 },
  );

  return (
    <>
      <PageHeader title="Budget" description="Remaining = Approved budget − Actual spend. Edit budgets and record spend on each project’s Budget tab." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total approved" value={formatINR(s.budget.totalApproved)} />
        <Stat label="Total spent" value={formatINR(s.budget.totalSpent)} />
        <Stat label="Total remaining" value={formatINR(s.budget.totalRemaining)} tone={s.budget.totalRemaining < 0 ? "danger" : "default"} />
        <Stat label="Pending approval" value={`${formatINR(s.budget.pendingApprovalAmount)} (${s.pendingApprovalProjects.length})`} tone={s.pendingApprovalProjects.length ? "warning" : "default"} />
      </div>
      {s.budget.overBudget.length > 0 && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Over budget: {s.budget.overBudget.map((p) => `${p.name} (${formatINR(-p.remaining_budget)} over)`).join(", ")}
        </p>
      )}
      <Card className="mt-5">
        <CardHeader title="By project" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">Approval</th>
                <th className="px-3 py-2 text-right font-medium">Estimated</th>
                <th className="px-3 py-2 text-right font-medium">Quoted</th>
                <th className="px-3 py-2 text-right font-medium">Approved</th>
                <th className="px-3 py-2 text-right font-medium">Spent</th>
                <th className="px-4 py-2 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.slug}?tab=budget`} className="font-medium hover:text-brand-700">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <BudgetStatusBadge status={p.budget_status} />
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{formatINR(p.estimated_budget)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatINR(p.quoted_amount)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatINR(p.approved_budget)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatINR(p.actual_spend)}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-medium", p.approved_budget !== null && p.remaining_budget < 0 && "text-red-600")}>
                    {p.approved_budget === null ? "—" : formatINR(p.remaining_budget)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
              <tr>
                <td className="px-4 py-2.5" colSpan={2}>
                  Total
                </td>
                <td className="tabular px-3 py-2.5 text-right">{formatINR(totals.est)}</td>
                <td className="tabular px-3 py-2.5 text-right">{formatINR(totals.quote)}</td>
                <td className="tabular px-3 py-2.5 text-right">{formatINR(totals.appr)}</td>
                <td className="tabular px-3 py-2.5 text-right">{formatINR(totals.spent)}</td>
                <td className={cn("tabular px-4 py-2.5 text-right", totals.appr - totals.spent < 0 && "text-red-600")}>{formatINR(totals.appr - totals.spent)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}
