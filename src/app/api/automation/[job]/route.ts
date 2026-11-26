import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWorkspace } from "@/lib/data/workspace";
import {
  buildManagerUpdate,
  dueReminders,
  eveningDigest,
  isAuthorizedAutomation,
  morningDigest,
  overdueMessage,
  waitingFollowups,
} from "@/lib/automation";

export const dynamic = "force-dynamic";

// Individual jobs, for n8n workflows that want separate schedules:
//   POST /api/automation/morning | evening | overdue | waiting-followups | due-reminders | recurring | manager-report
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!isAuthorizedAutomation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await params;
  try {
    const admin = createAdminClient();
    const ws = await loadWorkspace(admin);
    switch (job) {
      case "morning":
        return NextResponse.json({ messages: [await morningDigest(admin, ws)] });
      case "evening":
        return NextResponse.json({ messages: [await eveningDigest(admin, ws)] });
      case "overdue": {
        const m = overdueMessage(ws);
        return NextResponse.json({ messages: m ? [m] : [] });
      }
      case "waiting-followups":
        return NextResponse.json({ messages: await waitingFollowups(admin, ws) });
      case "due-reminders":
        return NextResponse.json({ messages: await dueReminders(admin) });
      case "recurring": {
        const { data, error } = await admin.rpc("generate_recurring_tasks", { p_date: ws.today });
        if (error) throw new Error(error.message);
        return NextResponse.json({ created: data ?? 0, messages: [] });
      }
      case "manager-report": {
        // Generated as a DRAFT for review in the app. Never sent automatically.
        const kind = new URL(request.url).searchParams.get("kind") === "WEEKLY" ? "WEEKLY" : "DAILY";
        const r = buildManagerUpdate(ws, kind);
        const { data } = await admin.from("reports").insert({ report_type: kind, title: r.title, content: r.content, status: "DRAFT" }).select("id").single();
        return NextResponse.json({
          report_id: data?.id,
          messages: [{ type: "MANAGER_UPDATE", title: "Manager update draft ready", text: "A draft manager update is ready to review on the Reports page." }],
        });
      }
      default:
        return NextResponse.json({ error: `Unknown job “${job}”` }, { status: 404 });
    }
  } catch (e) {
    console.error("automation job failed", job, e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Job failed" }, { status: 500 });
  }
}
