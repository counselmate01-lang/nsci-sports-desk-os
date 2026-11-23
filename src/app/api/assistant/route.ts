import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data/workspace";
import { runAssistant } from "@/lib/ai/engine";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const ws = await loadWorkspace(supabase);
    const result = await runAssistant(ws, parsed.data.messages);
    return NextResponse.json(result);
  } catch (e) {
    console.error("assistant error", e);
    return NextResponse.json({ error: "The assistant failed. Please try again." }, { status: 500 });
  }
}
