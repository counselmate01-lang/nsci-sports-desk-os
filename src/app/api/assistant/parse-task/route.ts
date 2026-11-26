import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data/workspace";
import { parseTaskSentence } from "@/lib/ai/parse";
import { resolveProject } from "@/lib/ai/resolve";
import { serverEnv } from "@/lib/env";
import { PRIORITIES, STATUSES } from "@/lib/types";

// Turns "Send court repair email tomorrow, priority P0" into task form fields.
// Uses OpenAI when configured, otherwise the built-in rule parser.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = z.object({ text: z.string().trim().min(2).max(500) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type a short sentence first." }, { status: 400 });

  const ws = await loadWorkspace(supabase);
  const rules = parseTaskSentence(ws, parsed.data.text);
  const { openaiKey, openaiModel } = serverEnv();
  if (!openaiKey) return NextResponse.json({ ...rules, mode: "basic" });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          {
            role: "system",
            content: `Extract a task from the user's sentence. Today is ${ws.today} (${new Date(ws.today + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}). Projects: ${ws.projects.map((p) => p.name).join("; ")}. Only fill fields the sentence states or clearly implies; leave others empty. Title is a short imperative phrase without the date or priority.`,
          },
          { role: "user", content: parsed.data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_task",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  project: { type: "string" },
                  priority: { type: "string", enum: PRIORITIES },
                  status: { type: "string", enum: STATUSES },
                  due_date: { type: "string", description: "YYYY-MM-DD" },
                  waiting_for: { type: "string" },
                  assigned_to: { type: "string" },
                },
                required: ["title"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_task" } },
      }),
    });
    if (!res.ok) return NextResponse.json({ ...rules, mode: "basic" });
    const data = await res.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    const project = resolveProject(ws, args.project) ?? (rules.project_id ? ws.projects.find((p) => p.id === rules.project_id) : null);
    return NextResponse.json({
      title: typeof args.title === "string" ? args.title.slice(0, 200) : rules.title,
      project_id: project?.id ?? null,
      priority: PRIORITIES.includes(args.priority) ? args.priority : rules.priority,
      status: STATUSES.includes(args.status) ? args.status : rules.status,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(args.due_date ?? "") ? args.due_date : rules.due_date,
      waiting_for: args.waiting_for || rules.waiting_for,
      assigned_to: args.assigned_to || rules.assigned_to,
      mode: "ai",
    });
  } catch {
    return NextResponse.json({ ...rules, mode: "basic" });
  }
}
