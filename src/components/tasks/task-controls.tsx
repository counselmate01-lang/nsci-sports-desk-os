"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { setTaskStatus } from "@/app/actions/tasks";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskStatusSelect({ taskId, status, disabled }: { taskId: string; status: Status; disabled?: boolean }) {
  const [pending, start] = React.useTransition();
  const [value, setValue] = React.useState(status);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setValue(status);
  }, [status]);
  return (
    <span className="inline-flex flex-col">
      <select
        aria-label="Change status"
        value={value}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.value as Status;
          const prev = value;
          setValue(next);
          start(async () => {
            const r = await setTaskStatus(taskId, next);
            if (!r.ok) {
              setValue(prev);
              setError(r.error);
            } else setError(null);
          });
        }}
        className={cn(
          "h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 hover:border-slate-300 focus:border-brand-600 focus:outline-none",
          pending && "opacity-60",
        )}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}

export function CompleteButton({ taskId, done, disabled }: { taskId: string; done: boolean; disabled?: boolean }) {
  const [pending, start] = React.useTransition();
  return (
    <button
      type="button"
      title={done ? "Mark as not done" : "Mark complete"}
      aria-label={done ? "Mark as not done" : "Mark complete"}
      disabled={disabled || pending}
      onClick={() => start(async () => void (await setTaskStatus(taskId, done ? "PENDING" : "COMPLETED")))}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
        done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent hover:border-emerald-600 hover:text-emerald-600",
        pending && "opacity-50",
      )}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </button>
  );
}
