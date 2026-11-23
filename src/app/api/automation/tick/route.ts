import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAutomation, runTick } from "@/lib/automation";

export const dynamic = "force-dynamic";

// POST /api/automation/tick  (n8n, every 15 minutes)
// Returns { messages: [{ type, title, text }] } for n8n to deliver.
export async function POST(request: Request) {
  if (!isAuthorizedAutomation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runTick(createAdminClient()));
  } catch (e) {
    console.error("tick failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tick failed" }, { status: 500 });
  }
}
