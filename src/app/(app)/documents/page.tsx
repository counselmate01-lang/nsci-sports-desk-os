import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { DocumentForm, DocumentTable } from "@/components/documents/documents";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { DOC_TYPES, DOC_TYPE_LABEL, type DocumentRow } from "@/lib/types";
import { driveFolderFor, DRIVE_ROOT } from "@/lib/drive";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string; project?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  let q = supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(500);
  if (sp.type && (DOC_TYPES as readonly string[]).includes(sp.type)) q = q.eq("doc_type", sp.type);
  const proj = ws.projects.find((p) => p.slug === sp.project);
  if (proj) q = q.eq("project_id", proj.id);
  const { data } = await q.returns<DocumentRow[]>();
  const canEdit = profile?.role !== "viewer";
  const projectNames = new Map(ws.projects.map((p) => [p.id, p.name]));
  const taskNames = new Map(ws.tasks.map((t) => [t.id, t.title]));
  const link = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...params })) if (v) u.set(k, v);
    return `/documents?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="Documents" description="Quotations, approvals, PDFs, images, Excel files and notes across all projects." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={link({ type: undefined })} className={cn("rounded-full border px-2.5 py-1 text-xs", !sp.type ? "border-brand-700 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600")}>
          All types
        </Link>
        {DOC_TYPES.map((t) => (
          <Link key={t} href={link({ type: t })} className={cn("rounded-full border px-2.5 py-1 text-xs", sp.type === t ? "border-brand-700 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600")}>
            {DOC_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={`${data?.length ?? 0} documents${proj ? ` · ${proj.name}` : ""}`} />
            <DocumentTable docs={data ?? []} canEdit={canEdit} projectNames={projectNames} taskNames={taskNames} />
          </Card>
          <Card>
            <CardHeader title="Google Drive folders" description="Drive API integration comes later; paste folder links into each project for now." />
            <ul className="divide-y divide-slate-100">
              {ws.projects.map((p) => {
                const f = driveFolderFor(p.slug, p.name);
                return (
                  <li key={p.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {DRIVE_ROOT}/{f.folder}/{"{"}
                        {f.subfolders.join(", ")}
                        {"}"}
                      </p>
                    </div>
                    {p.drive_folder_url ? (
                      <a href={p.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Open folder
                      </a>
                    ) : (
                      <Link href={`/projects/${p.slug}?tab=documents`} className="text-xs text-slate-500 hover:text-slate-800">
                        No folder linked
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        {canEdit && (
          <Card>
            <CardHeader title="Add document" />
            <CardBody>
              <DocumentForm projects={ws.projects.map((p) => ({ id: p.id, name: p.name }))} />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
