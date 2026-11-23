"use client";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { Empty } from "@/components/ui/card";
import { deleteExpense } from "@/app/actions/projects";
import { formatINR } from "@/lib/utils";
import type { Expense } from "@/lib/types";

export function ExpenseList({ expenses, canEdit, taskNames }: { expenses: Expense[]; canEdit: boolean; taskNames: Map<string, string> }) {
  if (!expenses.length) return <Empty>No spend recorded yet.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {expenses.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{e.description}</p>
            <p className="text-xs text-slate-500">
              {[e.spent_on, e.vendor, e.task_id ? taskNames.get(e.task_id) : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="tabular font-medium">{formatINR(Number(e.amount))}</span>
          {canEdit && (
            <ConfirmButton size="sm" variant="ghost" confirmLabel="Confirm" onConfirm={() => deleteExpense(e.id)}>
              Remove
            </ConfirmButton>
          )}
        </li>
      ))}
    </ul>
  );
}
