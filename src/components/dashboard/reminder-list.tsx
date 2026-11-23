"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";
import { dismissReminder } from "@/app/actions/misc";

export interface ReminderItem {
  id: string;
  title: string;
  message: string | null;
  when: string;
  taskId: string | null;
  kind: string;
}

export function ReminderList({ reminders, canEdit }: { reminders: ReminderItem[]; canEdit: boolean }) {
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [, start] = React.useTransition();
  const visible = reminders.filter((r) => !hidden.includes(r.id));
  if (!visible.length) return null;
  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50">
      <p className="flex items-center gap-2 border-b border-amber-200 px-4 py-2 text-xs font-semibold text-amber-900">
        <BellRing className="h-3.5 w-3.5" /> Reminders due
      </p>
      <ul className="divide-y divide-amber-100">
        {visible.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-2 text-sm">
            <div className="min-w-0 flex-1">
              {r.taskId ? (
                <Link href={`/tasks/${r.taskId}`} className="font-medium text-amber-950 hover:underline">
                  {r.title}
                </Link>
              ) : (
                <span className="font-medium text-amber-950">{r.title}</span>
              )}
              {r.message && <p className="text-xs text-amber-800">{r.message}</p>}
              <p className="text-[11px] text-amber-700">
                {r.kind === "WAITING_FOLLOWUP" ? "Follow-up · " : ""}
                {r.when}
              </p>
            </div>
            {canEdit && (
              <button
                aria-label="Dismiss reminder"
                className="rounded p-1 text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  setHidden((h) => [...h, r.id]);
                  start(async () => void (await dismissReminder(r.id)));
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
