import type { Metadata } from "next";
import { Card, CardBody, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/badges";
import { ReportEditor } from "@/components/reports/report-editor";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { formatDateTime } from "@/lib/dates";
import type { Report } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

const TYPE_LABEL: Record<Report["report_type"], string> = {
  DAILY: "Daily update",
  WEEKLY: "Weekly update",
  MORNING_DIGEST: "9 AM reminder",
  EVENING_DIGEST: "Evening reminder",
};

export default async function ReportsPage() {
  const { supabase, profile } = await requireUser();
  const ws = await getWorkspace();
  const { data: reports } = await supabase.from("reports").select("*").order("generated_at", { ascending: false }).limit(30).returns<Report[]>();

  return (
    <>
      <PageHeader title="Manager reports" description="Generate → Review → Send. Built only from what is recorded in the system." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Generate Manager Update" />
          <CardBody>
            <ReportEditor canEdit={profile?.role !== "viewer"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="History" description="Saved updates and automated reminders" />
          {!reports?.length ? (
            <Empty>No saved reports yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {reports.map((r) => (
                <li key={r.id}>
                  <details className="px-4 py-2.5">
                    <summary className="cursor-pointer list-none">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{TYPE_LABEL[r.report_type]}</span>
                        <Tag tone={r.status === "SENT" ? "blue" : r.status === "REVIEWED" ? "amber" : "slate"}>{r.status}</Tag>
                      </span>
                      <span className="text-[11px] text-slate-500">{formatDateTime(r.generated_at, ws.tz)}</span>
                    </summary>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">{r.content}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
