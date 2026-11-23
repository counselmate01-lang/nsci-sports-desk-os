"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteTask, toggleChecklistItem, updateTask } from "@/app/actions/tasks";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type ChecklistItem, type Task } from "@/lib/types";

export function TaskEditForm({
  task,
  projects,
  siblingTasks,
  canEdit,
}: {
  task: Task;
  projects: { id: string; name: string }[];
  siblingTasks: { id: string; title: string }[];
  canEdit: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction(updateTask);
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  const others = siblingTasks.filter((t) => t.id !== task.id);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={task.id} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Title" htmlFor="e-title" required>
          <Input id="e-title" name="title" defaultValue={task.title} required maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Status" htmlFor="e-status" required>
            <Select id="e-status" name="status" defaultValue={task.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="e-priority" required>
            <Select id="e-priority" name="priority" defaultValue={task.priority}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project" htmlFor="e-project" required>
            <Select id="e-project" name="project_id" defaultValue={task.project_id}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="e-due">
            <Input id="e-due" name="due_date" type="date" defaultValue={task.due_date ?? ""} />
          </Field>
          <Field label="Start date" htmlFor="e-start">
            <Input id="e-start" name="start_date" type="date" defaultValue={task.start_date ?? ""} />
          </Field>
          <Field label="Owner" htmlFor="e-owner">
            <Input id="e-owner" name="owner" defaultValue={task.owner ?? ""} maxLength={100} />
          </Field>
          <Field label="Assigned to" htmlFor="e-assigned">
            <Input id="e-assigned" name="assigned_to" defaultValue={task.assigned_to ?? ""} maxLength={100} />
          </Field>
          <Field label="Waiting for" htmlFor="e-waiting" className="sm:col-span-2">
            <Input id="e-waiting" name="waiting_for" defaultValue={task.waiting_for ?? ""} maxLength={200} placeholder="e.g. Shrey, Management, Vendor quote" />
          </Field>
          <Field label="Depends on task" htmlFor="e-depends" className="sm:col-span-2" hint="This task is blocked until that one is completed">
            <Select id="e-depends" name="depends_on_task_id" defaultValue={task.depends_on_task_id ?? ""}>
              <option value="">— None —</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Other dependency" htmlFor="e-dep">
            <Input id="e-dep" name="dependency" defaultValue={task.dependency ?? ""} maxLength={300} />
          </Field>
          <Field label="Next action (for this task)" htmlFor="e-next" className="sm:col-span-2">
            <Input id="e-next" name="next_action" defaultValue={task.next_action ?? ""} maxLength={300} />
          </Field>
          <Field label="When done, next task becomes" htmlFor="e-nexttask" hint="Workflow rule for the project’s next action">
            <Select id="e-nexttask" name="next_task_id" defaultValue={task.next_task_id ?? ""}>
              <option value="">— Automatic —</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated budget (₹)" htmlFor="e-est">
            <Input id="e-est" name="estimated_budget" inputMode="decimal" defaultValue={task.estimated_budget ?? ""} />
          </Field>
          <Field label="Approved budget (₹)" htmlFor="e-appr">
            <Input id="e-appr" name="approved_budget" inputMode="decimal" defaultValue={task.approved_budget ?? ""} />
          </Field>
          <Field label="Actual spend (₹)" htmlFor="e-spent">
            <Input id="e-spent" name="actual_spend" inputMode="decimal" defaultValue={task.actual_spend ?? ""} />
          </Field>
        </div>
        <Field label="Description" htmlFor="e-desc">
          <Textarea id="e-desc" name="description" rows={2} defaultValue={task.description ?? ""} />
        </Field>
        <Field label="Notes" htmlFor="e-notes">
          <Textarea id="e-notes" name="notes" rows={4} defaultValue={task.notes ?? ""} />
        </Field>
      </fieldset>
      <FormMessage state={state} />
      {canEdit && (
        <div className="flex items-center justify-between gap-2">
          <ConfirmButton
            size="sm"
            variant="ghost"
            confirmLabel="Delete this task permanently?"
            onConfirm={async () => {
              const r = await deleteTask(task.id);
              if (r.ok) router.push("/tasks");
            }}
          >
            Delete task
          </ConfirmButton>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function Checklist({ taskId, items, canEdit }: { taskId: string; items: ChecklistItem[]; canEdit: boolean }) {
  const [local, setLocal] = React.useState(items);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [, start] = React.useTransition();
  React.useEffect(() => {
    setLocal(items);
  }, [items]);
  return (
    <div>
      <ul className="space-y-1">
        {local.map((item, i) => (
          <li key={i}>
            <label className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={item.done}
                disabled={!canEdit}
                onChange={(e) => {
                  const done = e.target.checked;
                  setLocal((l) => l.map((x, j) => (j === i ? { ...x, done } : x)));
                  start(async () => {
                    const r = await toggleChecklistItem(taskId, i, done);
                    setMsg(r.ok ? (r.message ?? null) : r.error);
                  });
                }}
              />
              <span className={item.done ? "text-slate-400 line-through" : "text-slate-800"}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
