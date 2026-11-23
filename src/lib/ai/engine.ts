import "server-only";
import { serverEnv } from "@/lib/env";
import { weekdayName } from "@/lib/dates";
import type { Workspace } from "@/lib/data/workspace";
import type { ProposedAction } from "./actions";
import { runTool, TOOL_DEFINITIONS } from "./tools";
import { fallbackAnswer } from "./fallback";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  reply: string;
  proposals: ProposedAction[];
  mode: "ai" | "basic";
}

function systemPrompt(ws: Workspace, channel: "web" | "whatsapp") {
  return `You are "Sports Desk AI", the assistant for the NSCI Sports Desk team's internal operations system.

Today is ${weekdayName(ws.today)} ${ws.today} (time zone ${ws.tz}). Money is in Indian Rupees (₹).
Projects: ${ws.projects.map((p) => `${p.name} [${p.status}, ${p.priority}${p.aliases.length ? `, aka ${p.aliases.join("/")}` : ""}]`).join("; ")}.

RULES
1. Answer ONLY from tool results. Always call a tool before answering a question about work, tasks, people, projects or budget.
2. NEVER invent tasks, people, dates, amounts or statuses. If the data is not in the tool results, say it is not available in the system.
3. To change anything (create task, mark complete, change priority/status/waiting-for, set reminder), call a propose_* tool. Nothing is saved until the person presses Confirm. Tell them to review and confirm. Never claim a change is done.
4. To find a task to update, call list_tasks with a short 'query' first and use the exact task_id. If several tasks could match, list them and ask which one.
5. Resolve relative dates yourself: "tomorrow" = the day after ${ws.today}; weekday names mean the next such day after today. Times are 24h in ${ws.tz}.
6. "Waiting for management/Shrey/X" means tasks or projects whose waiting_for contains that name.
7. You cannot delete anything. If asked, say deletion must be done in the app.
8. Be concise and professional. Use short bullet lists ("• "). ${channel === "whatsapp" ? "Plain text only (WhatsApp), max ~12 lines." : "Plain text, no markdown tables."}
9. Tasks with status TBD (e.g. the Delhi vs Mumbai tournament) are not active work; mention them only if asked.`;
}

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export async function runAssistant(ws: Workspace, history: ChatMessage[], channel: "web" | "whatsapp" = "web"): Promise<AssistantReply> {
  const { openaiKey, openaiModel } = serverEnv();
  const last = history[history.length - 1]?.content ?? "";
  if (!openaiKey) {
    return { ...fallbackAnswer(ws, last), mode: "basic" };
  }

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt(ws, channel) },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content }) as OpenAIMessage),
  ];
  const ctx = { ws, proposals: [] as ProposedAction[] };

  for (let step = 0; step < 6; step++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: openaiModel, messages, tools: TOOL_DEFINITIONS, tool_choice: "auto" }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("OpenAI error", res.status, body.slice(0, 500));
      const basic = fallbackAnswer(ws, last);
      return {
        reply: `The AI service returned an error (${res.status}${res.status === 401 ? ": check OPENAI_API_KEY" : res.status === 429 ? ": quota or rate limit" : ""}). Here is a basic answer instead:\n\n${basic.reply}`,
        proposals: basic.proposals,
        mode: "basic",
      };
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: Record<string, string | undefined> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* bad JSON from model: run with no args */
        }
        let result: unknown;
        try {
          result = runTool(call.function.name, args, ctx);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "Tool failed" };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 30_000) });
      }
      continue;
    }
    return { reply: (msg.content ?? "").trim() || "I could not find an answer in the system.", proposals: ctx.proposals, mode: "ai" };
  }
  return {
    reply: ctx.proposals.length ? "Please review the change(s) below and press Confirm." : "Sorry, I could not complete that. Please rephrase.",
    proposals: ctx.proposals,
    mode: "ai",
  };
}
