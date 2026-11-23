"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { createProject, updateProject, updateProjectBudget, addExpense } from "@/app/actions/projects";
import { QuickTaskDialog } from "@/components/tasks/quick-task-dialog";
import {
  BUDGET_STATUSES,
  BUDGET_STATUS_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Project,
} from "@/lib/types";
import type { ActionResult } from "@/lib/validation";

function useCloseOnSuccess(state: ActionResult | null, onDone: () => void) {
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function ProjectFields({ p }: { p?: Project }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Project name" htmlFor="p-name" required className="sm:col-span-2">
        <Input id="p-name" name="name" required maxLength={120} defaultValue={p?.name} />
      </Field>
      <Field label="Status" htmlFor="p-status" required>
        <Select id="p-status" name="status" defaultValue={p?.status ?? "PENDING"}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="p-priority" required>
        <Select id="p-priority" name="priority" defaultValue={p?.priority ?? "P2"}>
          {PRIORITIES.map((s) => (
            <option key={s} value={s}>
              {PRIORITY_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Current stage" htmlFor="p-stage">
        <Input id="p-stage" name="current_stage" maxLength={200} defaultValue={p?.current_stage ?? ""} />
      </Field>
      <Field label="Owner (responsible)" htmlFor="p-owner">
        <Input id="p-owner" name="owner" maxLength={100} defaultValue={p?.owner ?? ""} />
      </Field>
      <Field label="Next action" htmlFor="p-next" className="sm:col-span-2" hint="Updates automatically when tasks are completed">
        <Input id="p-next" name="next_action" maxLength={300} defaultValue={p?.next_action ?? ""} />
      </Field>
      <Field label="Waiting for" htmlFor="p-waiting">
        <Input id="p-waiting" name="waiting_for" maxLength={200} defaultValue={p?.waiting_for ?? ""} />
      </Field>
      <Field label="Google Drive folder link" htmlFor="p-drive">
        <Input id="p-drive" name="drive_folder_url" type="url" placeholder="https://drive.google.com/…" defaultValue={p?.drive_folder_url ?? ""} />
      </Field>
      <Field label="Start date" htmlFor="p-start">
        <Input id="p-start" name="start_date" type="date" defaultValue={p?.start_date ?? ""} />
      </Field>
      <Field label="Deadline (target date)" htmlFor="p-target">
        <Input id="p-target" name="target_date" type="date" defaultValue={p?.target_date ?? ""} />
      </Field>
      <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
        <Textarea id="p-desc" name="description" rows={3} defaultValue={p?.description ?? ""} />
      </Field>
    </div>
  );
}

export function NewProjectButton() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(createProject);
  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      if (state.id) router.push(`/projects/${state.id}`);
    }
  }, [state, router]);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New project
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <form onSubmit={onSubmit} className="space-y-4">
          <ProjectFields />
          <FormMessage state={state && !state.ok ? state : null} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = React.useState(false);
  const [state, onSubmit, pending] = useFormAction(updateProject);
  useCloseOnSuccess(state, () => setOpen(false));
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit project
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Edit ${project.name}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />
          <ProjectFields p={project} />
          <FormMessage state={state && !state.ok ? state : null} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function AddTaskButton({
  projects,
  projectId,
  today,
  label = "Add task",
}: {
  projects: { id: string; name: string }[];
  projectId?: string;
  today: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {label}
      </Button>
      <QuickTaskDialog open={open} onClose={() => setOpen(false)} projects={projects} defaultProjectId={projectId} today={today} />
    </>
  );
}

export function BudgetForm({ project }: { project: Project }) {
  const [state, onSubmit, pending] = useFormAction(updateProjectBudget);
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={project.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Estimated (₹)" htmlFor="b-est">
          <Input id="b-est" name="estimated_budget" inputMode="decimal" defaultValue={project.estimated_budget ?? ""} />
        </Field>
        <Field label="Quoted (₹)" htmlFor="b-quote" hint="e.g. the L1 quotation">
          <Input id="b-quote" name="quoted_amount" inputMode="decimal" defaultValue={project.quoted_amount ?? ""} />
        </Field>
        <Field label="Approved (₹)" htmlFor="b-appr">
          <Input id="b-appr" name="approved_budget" inputMode="decimal" defaultValue={project.approved_budget ?? ""} />
        </Field>
        <Field label="Approval status" htmlFor="b-status">
          <Select id="b-status" name="budget_status" defaultValue={project.budget_status}>
            {BUDGET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUDGET_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state && !state.ok && state.needsConfirm && (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <input type="checkbox" name="confirm_negative" value="yes" className="mt-0.5" /> I understand remaining budget will be negative. Save anyway.
        </label>
      )}
      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save budget"}
      </Button>
    </form>
  );
}

export function ExpenseForm({
  projectId,
  today,
  tasks,
}: {
  projectId: string;
  today: string;
  tasks: { id: string; title: string }[];
}) {
  const [state, onSubmit, pending] = useFormAction(addExpense);
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What was paid for" htmlFor="e-desc" required className="sm:col-span-2">
          <Input id="e-desc" name="description" required maxLength={200} />
        </Field>
        <Field label="Amount (₹)" htmlFor="e-amt" required>
          <Input id="e-amt" name="amount" inputMode="decimal" required />
        </Field>
        <Field label="Date" htmlFor="e-date" required>
          <Input id="e-date" name="spent_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="Vendor" htmlFor="e-vendor">
          <Input id="e-vendor" name="vendor" maxLength={120} />
        </Field>
        <Field label="Related task" htmlFor="e-task">
          <Select id="e-task" name="task_id" defaultValue="">
            <option value="">—</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state && !state.ok && state.needsConfirm && (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <input type="checkbox" name="confirm_over" value="yes" className="mt-0.5" /> Record it anyway
        </label>
      )}
      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Record spend"}
      </Button>
    </form>
  );
}
