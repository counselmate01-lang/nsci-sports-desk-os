"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { generateReport, saveReport } from "@/app/actions/misc";

type Kind = "DAILY" | "WEEKLY";

export function ReportEditor({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>("DAILY");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [id, setId] = React.useState<string | undefined>();
  const [status, setStatus] = React.useState<"DRAFT" | "REVIEWED" | "SENT" | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function generate(k: Kind) {
    setKind(k);
    start(async () => {
      const r = await generateReport(k);
      if (r.ok && r.content) {
        setTitle(r.title ?? "");
        setContent(r.content);
        setId(undefined);
        setStatus(null);
        setMsg("Generated from current data. Review and edit before sending.");
      } else setMsg(r.ok ? "Nothing generated" : r.error);
    });
  }

  function save(next: "DRAFT" | "REVIEWED" | "SENT") {
    start(async () => {
      const r = await saveReport({ id, kind, title, content, status: next });
      if (r.ok) {
        setId(r.id);
        setStatus(next);
        setMsg(r.message ?? "Saved");
        router.refresh();
      } else setMsg(r.error);
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setMsg("Copied. Paste it into WhatsApp or email.");
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(content)}`;
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(content)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate("DAILY")} disabled={pending}>
          <RefreshCw className="h-4 w-4" /> Generate daily update
        </Button>
        <Button variant="outline" onClick={() => generate("WEEKLY")} disabled={pending}>
          Generate weekly update
        </Button>
      </div>
      <ol className="flex flex-wrap gap-4 text-xs text-slate-500">
        <li className={content ? "font-medium text-slate-900" : ""}>1. Generate</li>
        <li className={status === "REVIEWED" || status === "SENT" ? "font-medium text-slate-900" : ""}>2. Review</li>
        <li className={status === "SENT" ? "font-medium text-slate-900" : ""}>3. Send (you send it; nothing is sent automatically)</li>
      </ol>
      {content && (
        <>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={22} className="font-mono text-xs leading-relaxed" aria-label="Report text" />
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={() => save("DRAFT")} disabled={pending}>
                  Save draft
                </Button>
                <Button size="sm" onClick={() => save("REVIEWED")} disabled={pending}>
                  Mark reviewed
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            {status === "REVIEWED" || status === "SENT" ? (
              <>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50">
                  <MessageCircle className="h-4 w-4" /> Open in WhatsApp
                </a>
                <a href={mail} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50">
                  <Mail className="h-4 w-4" /> Open in email
                </a>
                {canEdit && status !== "SENT" && (
                  <Button size="sm" variant="secondary" onClick={() => save("SENT")} disabled={pending}>
                    I’ve sent it
                  </Button>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-500">Mark reviewed to unlock sending.</span>
            )}
          </div>
        </>
      )}
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
