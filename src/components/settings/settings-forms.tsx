"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { deleteTemplate, runRecurringNow, saveTemplate, setTemplateActive, updateMyProfile, updateSettings } from "@/app/actions/misc";
import { FREQUENCIES, PRIORITIES, PRIORITY_LABEL, type AppSettings, type RecurringTemplate } from "@/lib/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ReminderSettingsForm({ settings, isAdmin }: { settings: AppSettings; isAdmin: boolean }) {
  const [state, onSubmit, pending] = useFormAction(updateSettings);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset disabled={!isAdmin} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Morning reminder" htmlFor="s-morning" hint="P0, due today, overdue, important waiting">
          <Input id="s-morning" name="morning_reminder_time" type="time" defaultValue={settings.morning_reminder_time.slice(0, 5)} />
        </Field>
        <Field label="Evening reminder" htmlFor="s-evening" hint="Completed today, still pending, overdue, carry-forward">
          <Input id="s-evening" name="evening_reminder_time" type="time" defaultValue={settings.evening_reminder_time.slice(0, 5)} />
        </Field>
        <Field label="Follow up waiting tasks after (days)" htmlFor="s-days">
          <Input id="s-days" name="waiting_followup_days" type="number" min={1} max={60} defaultValue={settings.waiting_followup_days} />
        </Field>
        <Field label="Time zone" htmlFor="s-tz">
          <Input id="s-tz" name="timezone" defaultValue={settings.timezone} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="reminders_enabled" defaultChecked={settings.reminders_enabled} /> Automatic reminders enabled
        </label>
      </fieldset>
      <FormMessage state={state} />
      {isAdmin ? (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save reminder settings"}
        </Button>
      ) : (
        <p className="text-xs text-slate-500">Only an admin can change these.</p>
      )}
    </form>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, onSubmit, pending] = useFormAction(updateMyProfile);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Your name (shown in the activity log)" htmlFor="pf-name">
        <Input id="pf-name" name="full_name" defaultValue={name} required maxLength={100} />
      </Field>
      <Field label="WhatsApp number" htmlFor="pf-phone" hint="International format, digits only, e.g. 919876543210. Used later for WhatsApp.">
        <Input id="pf-phone" name="phone" defaultValue={phone} inputMode="tel" maxLength={15} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function TemplateForm({ projects, today, template, onDone }: { projects: { id: string; name: string }[]; today: string; template?: RecurringTemplate; onDone?: () => void }) {
  const [state, onSubmit, pending] = useFormAction(saveTemplate);
  const [freq, setFreq] = React.useState(template?.frequency ?? "DAILY");
  const router = useRouter();
  React.useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="rt-title" required className="sm:col-span-2">
          <Input id="rt-title" name="title" required maxLength={200} defaultValue={template?.title} placeholder="e.g. Weekly review" />
        </Field>
        <Field label="Project" htmlFor="rt-project" required>
          <Select id="rt-project" name="project_id" required defaultValue={template?.project_id ?? ""}>
            <option value="">Choose…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Repeats" htmlFor="rt-freq" required>
          <Select id="rt-freq" name="frequency" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f === "CUSTOM" ? "Every N days" : f.charAt(0) + f.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        {freq === "WEEKLY" && (
          <Field label="On" htmlFor="rt-weekday">
            <Select id="rt-weekday" name="weekday" defaultValue={String(template?.weekday ?? 1)}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {freq === "MONTHLY" && (
          <Field label="Day of month" htmlFor="rt-mday" hint="31 = last day of the month">
            <Input id="rt-mday" name="month_day" type="number" min={1} max={31} defaultValue={template?.month_day ?? 1} />
          </Field>
        )}
        {freq === "CUSTOM" && (
          <Field label="Every how many days" htmlFor="rt-int">
            <Input id="rt-int" name="interval_days" type="number" min={1} max={365} defaultValue={template?.interval_days ?? 2} />
          </Field>
        )}
        <Field label="Priority" htmlFor="rt-priority">
          <Select id="rt-priority" name="priority" defaultValue={template?.priority ?? "P2"}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starts" htmlFor="rt-start">
          <Input id="rt-start" name="start_date" type="date" defaultValue={template?.start_date ?? today} />
        </Field>
        <Field label="Assigned to" htmlFor="rt-assigned">
          <Input id="rt-assigned" name="assigned_to" maxLength={100} defaultValue={template?.assigned_to ?? ""} />
        </Field>
        <Field label="Checklist (one item per line)" htmlFor="rt-check" className="sm:col-span-2">
          <Textarea id="rt-check" name="checklist" rows={5} defaultValue={template?.checklist.join("\n")} />
        </Field>
        <Field label="Description" htmlFor="rt-desc" className="sm:col-span-2">
          <Textarea id="rt-desc" name="description" rows={2} defaultValue={template?.description ?? ""} />
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {template ? "Save" : "Add recurring task"}
      </Button>
    </form>
  );
}

export function TemplateRow({ t, projectName, projects, today, canEdit }: { t: RecurringTemplate; projectName: string; projects: { id: string; name: string }[]; today: string; canEdit: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const when =
    t.frequency === "DAILY"
      ? "Every day"
      : t.frequency === "WEEKLY"
        ? `Every ${WEEKDAYS[t.weekday ?? 1]}`
        : t.frequency === "MONTHLY"
          ? `Monthly on day ${t.month_day}`
          : `Every ${t.interval_days} days`;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className={t.active ? "font-medium text-slate-900" : "font-medium text-slate-400 line-through"}>{t.title}</p>
          <p className="text-xs text-slate-500">
            {when} · {projectName} · {t.checklist.length} checklist items{t.last_generated_date ? ` · last created ${t.last_generated_date}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
              {editing ? "Close" : "Edit"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await setTemplateActive(t.id, !t.active);
                  router.refresh();
                })
              }
            >
              {t.active ? "Pause" : "Resume"}
            </Button>
            <ConfirmButton size="sm" variant="ghost" confirmLabel="Confirm remove" onConfirm={async () => { await deleteTemplate(t.id); router.refresh(); }}>
              Remove
            </ConfirmButton>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 rounded-md border border-slate-200 p-3">
          <TemplateForm projects={projects} today={today} template={t} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

export function RunRecurringButton() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await runRecurringNow(); setMsg(r.ok ? (r.message ?? "Done") : r.error); })}>
        Create today’s recurring tasks now
      </Button>
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </span>
  );
}
