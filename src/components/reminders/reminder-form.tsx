"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { createReminder } from "@/app/actions/misc";

export function ReminderButton({
  title,
  taskId,
  projectId,
  today,
}: {
  title: string;
  taskId?: string;
  projectId?: string;
  today: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, onSubmit, pending] = useFormAction(createReminder);
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BellPlus className="h-4 w-4" /> Remind me
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Set a reminder" className="max-w-md">
        <form onSubmit={onSubmit} className="space-y-3">
          {taskId && <input type="hidden" name="task_id" value={taskId} />}
          {projectId && <input type="hidden" name="project_id" value={projectId} />}
          <Field label="Reminder" htmlFor="r-title" required>
            <Input id="r-title" name="title" defaultValue={title} required maxLength={200} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="r-date" required>
              <Input id="r-date" name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Time" htmlFor="r-time" required>
              <Input id="r-time" name="time" type="time" defaultValue="10:00" required />
            </Field>
          </div>
          <Field label="Note" htmlFor="r-msg">
            <Textarea id="r-msg" name="message" rows={2} />
          </Field>
          <p className="text-xs text-slate-500">Shows on the dashboard when due, and is sent by n8n once automation is connected.</p>
          <FormMessage state={state && !state.ok ? state : null} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Set reminder"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
