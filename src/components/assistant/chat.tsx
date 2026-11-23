"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProposedAction } from "@/lib/ai/actions";

interface Msg {
  role: "user" | "assistant";
  content: string;
  proposals?: (ProposedAction & { state?: "pending" | "done" | "cancelled" | "error"; result?: string })[];
}

const SUGGESTIONS = [
  "What is pending?",
  "What is overdue?",
  "What are today's priorities?",
  "What am I waiting for?",
  "What is waiting for management approval?",
  "What is pending with Shrey?",
  "What is the status of badminton roofing?",
  "How much budget is remaining?",
  "Give me a manager update.",
  "Create a task to order shuttles tomorrow.",
  "Mark yoga video circulation as complete.",
  "Make court repair P0.",
];

export function AssistantChat({ aiEnabled, canEdit }: { aiEnabled: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        res.ok
          ? { role: "assistant", content: data.reply, proposals: (data.proposals ?? []).map((p: ProposedAction) => ({ ...p, state: "pending" })) }
          : { role: "assistant", content: data.error ?? "Something went wrong." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Could not reach the server. Check your connection." }]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(msgIndex: number, propId: string, confirm: boolean) {
    const update = (patch: Partial<NonNullable<Msg["proposals"]>[number]>) =>
      setMessages((m) =>
        m.map((msg, i) => (i !== msgIndex ? msg : { ...msg, proposals: msg.proposals?.map((p) => (p.id === propId ? { ...p, ...patch } : p)) })),
      );
    if (!confirm) return update({ state: "cancelled" });
    const prop = messages[msgIndex].proposals?.find((p) => p.id === propId);
    if (!prop) return;
    update({ state: "done", result: "Saving…" });
    const res = await fetch("/api/assistant/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: prop.action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      update({ state: "done", result: data.message });
      router.refresh();
    } else update({ state: "error", result: data.error ?? "Failed" });
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[28rem] flex-col rounded-lg border border-slate-200 bg-white">
      {!aiEnabled && (
        <p className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Basic mode: no OpenAI key is configured, so the assistant understands common questions and commands only. Add OPENAI_API_KEY for full natural language (see docs/AI_SETUP.md).
        </p>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <Bot className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-800">Ask about your work, or tell me what to change.</p>
            <p className="mt-1 text-xs text-slate-500">Answers come only from the database. Changes always need your confirmation.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600")}>
              {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </span>
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "text-right")}>
              <div className={cn("inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm", m.role === "user" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-900")}>
                {m.content}
              </div>
              {m.proposals?.map((p) => (
                <div key={p.id} className={cn("rounded-md border p-3 text-left text-sm", p.destructive ? "border-red-200 bg-red-50" : "border-slate-200 bg-white")}>
                  <p className="text-xs font-semibold text-slate-500">{p.destructive ? "Confirm (hard to undo)" : "Confirm change"}</p>
                  <p className="mt-1 text-slate-900">{p.summary}</p>
                  {p.state === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant={p.destructive ? "danger" : "primary"} onClick={() => decide(i, p.id, true)} disabled={!canEdit}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(i, p.id, false)}>
                        Cancel
                      </Button>
                      {!canEdit && <span className="self-center text-xs text-slate-500">View-only account</span>}
                    </div>
                  ) : (
                    <p className={cn("mt-2 text-xs", p.state === "error" ? "text-red-600" : p.state === "cancelled" ? "text-slate-500" : "text-emerald-700")}>
                      {p.state === "cancelled" ? "Cancelled. Nothing was changed." : p.result}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && <p className="pl-10 text-xs text-slate-500">Checking the database…</p>}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What is waiting for management? · Add task: Order shuttles by Wednesday"
          className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:border-brand-600 focus:outline-none"
          maxLength={2000}
          autoFocus
        />
        <Button type="submit" disabled={busy || !input.trim()} className="h-10">
          <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
