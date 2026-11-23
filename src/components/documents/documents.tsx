"use client";

import * as React from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "next/navigation";
import { ExternalLink, Paperclip, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { Empty } from "@/components/ui/card";
import { Tag } from "@/components/ui/badges";
import { addDocument, deleteDocument, getDocumentLink, markL1 } from "@/app/actions/projects";
import { DOC_TYPES, DOC_TYPE_LABEL, type DocumentRow } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export function DocumentForm({
  projectId,
  taskId,
  projects,
  tasks = [],
}: {
  projectId?: string;
  taskId?: string;
  projects?: { id: string; name: string }[];
  tasks?: { id: string; title: string }[];
}) {
  const [state, onSubmit, pending] = useFormAction(addDocument);
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [type, setType] = React.useState("QUOTATION");
  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setType("QUOTATION");
      router.refresh();
    }
  }, [state, router]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      {taskId && <input type="hidden" name="task_id" value={taskId} />}
      {projectId ? (
        <input type="hidden" name="project_id" value={projectId} />
      ) : (
        <Field label="Project" htmlFor="d-project" required>
          <Select id="d-project" name="project_id" required defaultValue="">
            <option value="">Choose…</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="d-title" required>
          <Input id="d-title" name="title" maxLength={200} placeholder="e.g. Roofing quotation – Vendor A" />
        </Field>
        <Field label="Type" htmlFor="d-type">
          <Select id="d-type" name="doc_type" value={type} onChange={(e) => setType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Link (Drive, Sheet, email…)" htmlFor="d-url" className="sm:col-span-2">
          <Input id="d-url" name="url" type="url" placeholder="https://" />
        </Field>
        <Field label="…or upload a file" htmlFor="d-file" hint="PDF, image or Excel, up to 20 MB" className="sm:col-span-2">
          <Input id="d-file" name="file" type="file" className="py-1.5" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx" />
        </Field>
        {(type === "QUOTATION" || type === "INVOICE") && (
          <>
            <Field label="Vendor" htmlFor="d-vendor">
              <Input id="d-vendor" name="vendor" maxLength={120} />
            </Field>
            <Field label="Amount (₹)" htmlFor="d-amount">
              <Input id="d-amount" name="amount" inputMode="decimal" />
            </Field>
          </>
        )}
        {tasks.length > 0 && (
          <Field label="Attach to task" htmlFor="d-task" className="sm:col-span-2">
            <Select id="d-task" name="task_id" defaultValue="">
              <option value="">— Project only —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Notes" htmlFor="d-notes" className="sm:col-span-2">
          <Textarea id="d-notes" name="notes" rows={2} />
        </Field>
      </div>
      {type === "QUOTATION" && (
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" name="is_l1" /> This is the selected L1 quotation
        </label>
      )}
      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add document"}
      </Button>
    </form>
  );
}

function OpenFile({ id }: { id: string }) {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await getDocumentLink(id);
            if (r.ok && r.url) window.open(r.url, "_blank", "noopener");
            else setError(r.ok ? "No file" : r.error);
          })
        }
      >
        <Paperclip className="h-3 w-3" /> {pending ? "Opening…" : "Open file"}
      </button>
      {error && <span className="ml-2 text-[11px] text-red-600">{error}</span>}
    </>
  );
}

export function DocumentTable({
  docs,
  canEdit,
  projectNames,
  taskNames,
}: {
  docs: DocumentRow[];
  canEdit: boolean;
  projectNames?: Map<string, string>;
  taskNames?: Map<string, string>;
}) {
  if (!docs.length) return <Empty>No documents yet. Add quotation links, approvals, PDFs or notes.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{d.title}</span>
              <Tag>{DOC_TYPE_LABEL[d.doc_type]}</Tag>
              {d.is_l1 && (
                <Tag tone="blue">
                  <Star className="mr-0.5 h-3 w-3" /> L1
                </Tag>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[projectNames?.get(d.project_id), d.task_id ? taskNames?.get(d.task_id) : null, d.vendor, d.amount !== null ? formatINR(d.amount) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {d.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{d.notes}</p>}
            <div className="mt-1 flex gap-3">
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Open link
                </a>
              )}
              {d.storage_path && <OpenFile id={d.id} />}
            </div>
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-2">
              {d.doc_type === "QUOTATION" && !d.is_l1 && (
                <ConfirmButton size="sm" variant="outline" confirmLabel="Confirm L1" onConfirm={() => markL1(d.id)}>
                  Select as L1
                </ConfirmButton>
              )}
              <ConfirmButton size="sm" variant="ghost" confirmLabel="Confirm remove" onConfirm={() => deleteDocument(d.id)}>
                Remove
              </ConfirmButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
