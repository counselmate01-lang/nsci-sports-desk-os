import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data/workspace";
import { assistantActionSchema, describeAction, executeAction } from "@/lib/ai/actions";

// Runs ONE change the person confirmed in the assistant. Re-validated here and
// executed as the signed-in user, so database permissions (RLS) still apply.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = assistantActionSchema.safeParse(body?.action);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const ws = await loadWorkspace(supabase);
  const check = describeAction(ws, parsed.data);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: 400 });

  const result = await executeAction(supabase, parsed.data, ws.tz);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  revalidatePath("/", "layout");
  return NextResponse.json({ message: result.message });
}
