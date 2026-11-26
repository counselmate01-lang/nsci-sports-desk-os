"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { createTask } from "@/app/actions/tasks";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  today: string;
}

export function QuickTaskDialog({ open, onClose, projects, defaultProjectId, today }: Props) {
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(createTask);
  const [more, setMore] = React.useState(false);
  const [values, setValues] = React.useState({
    title: "",
    project_id: defaultProjectId ?? "",
    priority: "P2",
    status: "PENDING",
    due_date: today,
    waiting_for: "",
    assigned_to: "",
    notes: "",
  });
  const [sentence, setSentence] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiMsg, setAiMsg] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      setValues((v) => ({ ...v, title: "", waiting_for: "", assigned_to: "", notes: "" }));
      setSentence("");
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  React.useEffect(() => {
    if (open && defaultProjectId) setValues((v) => ({ ...v, project_id: defaultProjectId }));
  }, [open, defaultProjectId]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function fillWithAI() {
    if (!sentence.trim()) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await fetch("/api/assistant/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiMsg(data.error ?? "Could not read that sentence.");
        return;
      }
      setValues((v) => ({
        ...v,
        title: data.title ?? v.title,
        project_id: data.project_id ?? v.project_id,
        priority: data.priority ?? v.priority,
        status: data.status ?? v.status,
        due_date: data.due_date ?? v.due_date,
        waiting_for: data.waiting_for ?? v.waiting_for,
        assigned_to: data.assigned_to ?? v.assigned_to,
      }));
      if (data.waiting_for || data.assigned_to) setMore(true);
      setAiMsg(data.project_id ? "Filled in. Check the fields, then Create task." : "Filled in, but please choose the project.");
    } catch {
      setAiMsg("Could not reach the assistant.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600" htmlFor="nl-task">
          <Sparkles className="h-3.5 w-3.5" /> Type it as a sentence (optional)
        </label>
        <div className="flex gap-2">
          <Input
            id="nl-task"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                fillWithAI();
              }
            }}
            placeholder="Send court repair email tomorrow, priority P0"
          />
          <Button variant="outline" onClick={fillWithAI} disabled={aiBusy || !sentence.trim()}>
            {aiBusy ? "Reading…" : "Fill"}
          </Button>
        </div>
        {aiMsg && <p className="mt-1.5 text-xs text-slate-600">{aiMsg}</p>}
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
        <Field label="Task title" htmlFor="t-title" required>
          <Input id="t-title" name="title" required maxLength={200} value={values.title} onChange={set("title")} autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project" htmlFor="t-project" required>
            <Select id="t-project" name="project_id" required value={values.project_id} onChange={set("project_id")}>
              <option value="">Choose…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="t-due" required>
            <Input id="t-due" type="date" name="due_date" required value={values.due_date} onChange={set("due_date")} />
          </Field>
          <Field label="Priority" htmlFor="t-priority" required>
            <Select id="t-priority" name="priority" value={values.priority} onChange={set("priority")}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="t-status" required>
            <Select id="t-status" name="status" value={values.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setMore((m) => !m)}>
          {more ? "Hide optional fields" : "More options (owner, waiting for, budget, notes, attachment)"}
        </button>

        <div className={more ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "hidden"}>
          <Field label="Owner" htmlFor="t-owner">
            <Input id="t-owner" name="owner" maxLength={100} />
          </Field>
          <Field label="Assigned to" htmlFor="t-assigned">
            <Input id="t-assigned" name="assigned_to" maxLength={100} value={values.assigned_to} onChange={set("assigned_to")} />
          </Field>
          <Field label="Waiting for" htmlFor="t-waiting" hint="Who or what you are waiting on">
            <Input id="t-waiting" name="waiting_for" maxLength={200} value={values.waiting_for} onChange={set("waiting_for")} />
          </Field>
          <Field label="Dependency" htmlFor="t-dep" hint="What must happen first">
            <Input id="t-dep" name="dependency" maxLength={300} />
          </Field>
          <Field label="Estimated budget (₹)" htmlFor="t-budget">
            <Input id="t-budget" name="estimated_budget" inputMode="decimal" />
          </Field>
          <Field label="Attachment link" htmlFor="t-att" hint="Drive / quotation link">
            <Input id="t-att" name="attachment_url" type="url" placeholder="https://" />
          </Field>
          <Field label="Notes" htmlFor="t-notes" className="sm:col-span-2">
            <Textarea id="t-notes" name="notes" rows={3} value={values.notes} onChange={set("notes")} />
          </Field>
        </div>

        <FormMessage state={state && !state.ok ? state : null} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
