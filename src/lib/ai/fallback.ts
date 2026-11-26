import { dashboardStats } from "@/lib/data/stats";
import { filterTasks } from "@/lib/data/filter";
import { projectNextAction, type Workspace } from "@/lib/data/workspace";
import { dueLabel } from "@/lib/dates";
import { buildManagerUpdate } from "@/lib/reports";
import { formatINR } from "@/lib/utils";
import { STATUS_LABEL, type TaskView } from "@/lib/types";
import { proposal, type ProposedAction } from "./actions";
import { parseDate, parsePriority, parseStatus, parseTaskSentence, parseTime } from "./parse";
import { findTasks, resolveProject } from "./resolve";

// "Basic mode": answers common questions and commands with simple rules,
// used when no OpenAI key is configured (or the AI service is down).
// Like the AI, it only reports what is in the database.

const line = (t: TaskView, today: string) =>
  `• ${t.title} (${t.projectName}${t.priority === "P0" ? ", P0" : ""}${t.due_date ? `, ${dueLabel(t.due_date, today)}` : ""}${t.waiting_for ? `, waiting: ${t.waiting_for}` : ""})`;

function list(title: string, tasks: TaskView[], today: string, empty: string, max = 12) {
  if (!tasks.length) return empty;
  const more = tasks.length > max ? `\n…and ${tasks.length - max} more` : "";
  return `${title} (${tasks.length}):\n${tasks.slice(0, max).map((t) => line(t, today)).join("\n")}${more}`;
}

export function fallbackAnswer(ws: Workspace, input: string): { reply: string; proposals: ProposedAction[] } {
  const text = input.trim();
  const t = text.toLowerCase();
  const s = dashboardStats(ws);
  const proposals: ProposedAction[] = [];
  const propose = (raw: unknown) => {
    const p = proposal(ws, raw);
    if ("error" in p) return p.error;
    proposals.push(p);
    return null;
  };
  const done = (reply: string) => ({ reply, proposals });

  // ---------- Commands ----------
  if (/^(please\s+)?(add|create|new)\b.*\btask\b/.test(t) || /^add task/.test(t)) {
    const parsed = parseTaskSentence(ws, text);
    if (!parsed.title) return done("What should the task be called?");
    if (!parsed.project_id) return done(`Which project is “${parsed.title}” for? Projects: ${ws.projects.map((p) => p.name).join(", ")}.`);
    const err = propose({
      type: "create_task",
      project_id: parsed.project_id,
      title: parsed.title,
      priority: parsed.priority ?? "P2",
      status: parsed.status ?? "PENDING",
      due_date: parsed.due_date ?? ws.today,
      waiting_for: parsed.waiting_for,
      assigned_to: parsed.assigned_to,
    });
    return done(err ?? "Please review and confirm the new task below.");
  }

  const remind = t.match(/^remind me (?:about |to )?(.+)$/);
  if (remind) {
    const date = parseDate(text, ws.today);
    const time = parseTime(text);
    if (!date) return done("When should I remind you? e.g. “Remind me about roofing tomorrow at 10”.");
    const subject = remind[1]
      .replace(new RegExp(date.match, "i"), "")
      .replace(time ? new RegExp(time.match, "i") : /$^/, "")
      .trim();
    const project = resolveProject(ws, subject);
    const err = propose({
      type: "create_reminder",
      title: `Reminder: ${subject || project?.name || "follow up"}`,
      date: date.date,
      time: time?.time ?? "10:00",
      project_id: project?.id ?? null,
    });
    return done(err ?? "Please confirm the reminder below.");
  }

  const completeMatch = t.match(/^(?:mark |set )?(.+?) (?:as )?(?:complete|completed|done)$/) ?? t.match(/^(?:complete|finish|close) (.+)$/);
  if (completeMatch) {
    const subject = completeMatch[1].replace(/^mark /, "");
    const tasks = findTasks(ws, subject, { openOnly: true });
    if (!tasks.length) return done(`I couldn’t find an open task matching “${subject}”.`);
    if (tasks.length > 1 && tasks[0].title.toLowerCase() !== subject) {
      return done(`Which task do you mean?\n${tasks.slice(0, 5).map((x) => `• ${x.title} (${x.projectName})`).join("\n")}`);
    }
    const err = propose({ type: "update_task", task_id: tasks[0].id, changes: { status: "COMPLETED" } });
    return done(err ?? "Please confirm below.");
  }

  const prio = parsePriority(t);
  const makeMatch = t.match(/^(?:make|set|change) (.+?) (?:to |as )?(?:priority )?p[0-3]$/);
  if (prio && makeMatch) {
    const subject = makeMatch[1];
    const project = resolveProject(ws, subject);
    const tasks = findTasks(ws, subject, { openOnly: true });
    if (project && (!tasks.length || tasks[0].project_id === project.id)) {
      const err = propose({ type: "update_project", project_id: project.id, changes: { priority: prio.priority } });
      return done(err ?? "Please confirm below.");
    }
    if (tasks.length) {
      const err = propose({ type: "update_task", task_id: tasks[0].id, changes: { priority: prio.priority } });
      return done(err ?? "Please confirm below.");
    }
    return done(`I couldn’t find a project or task matching “${subject}”.`);
  }

  const waitingSet = t.match(/^(?:set|mark) (.+?) (?:as )?waiting (?:for|on) (.+)$/);
  if (waitingSet) {
    const project = resolveProject(ws, waitingSet[1]);
    const who = text.slice(text.toLowerCase().lastIndexOf(waitingSet[2]), text.length).trim();
    if (project) {
      const err = propose({ type: "update_project", project_id: project.id, changes: { waiting_for: who, status: "WAITING" } });
      return done(err ?? "Please confirm below.");
    }
    const tasks = findTasks(ws, waitingSet[1], { openOnly: true });
    if (tasks.length) {
      const err = propose({ type: "update_task", task_id: tasks[0].id, changes: { waiting_for: who, status: "WAITING" } });
      return done(err ?? "Please confirm below.");
    }
    return done(`I couldn’t find “${waitingSet[1]}”.`);
  }

  const move = t.match(/^(?:move|set|mark|change) (.+?) (?:to|as) (in progress|pending|waiting|tbd|cancelled|completed|complete|done)$/);
  if (move) {
    const status = parseStatus(move[2]);
    const project = resolveProject(ws, move[1]);
    if (status && project) {
      const err = propose({ type: "update_project", project_id: project.id, changes: { status } });
      return done(err ?? "Please confirm below.");
    }
    const tasks = findTasks(ws, move[1], { openOnly: true });
    if (status && tasks.length) {
      const err = propose({ type: "update_task", task_id: tasks[0].id, changes: { status } });
      return done(err ?? "Please confirm below.");
    }
    return done(`I couldn’t find “${move[1]}”.`);
  }

  // ---------- Questions ----------
  if (/manager update|report|summary for (my )?manager/.test(t)) {
    return done(buildManagerUpdate(ws, /week/.test(t) ? "WEEKLY" : "DAILY").content);
  }
  if (/overdue|late|missed/.test(t)) return done(list("Overdue", s.overdue, ws.today, "Nothing is overdue."));
  if (/today|priorit/.test(t)) {
    return done(list("Today’s priorities", s.todaysPriorities, ws.today, "No overdue, due-today or P0 tasks."));
  }
  if (/budget|spend|spent|money|cost/.test(t)) {
    const b = s.budget;
    if (!b.totalApproved && !b.totalSpent && !b.totalEstimated) return done("No budget figures have been entered in the system yet.");
    const lines = ws.projects
      .filter((p) => p.approved_budget !== null || p.actual_spend || p.estimated_budget)
      .map((p) => `• ${p.name}: approved ${formatINR(p.approved_budget)}, spent ${formatINR(p.actual_spend)}, remaining ${p.approved_budget === null ? "—" : formatINR(p.remaining_budget)}`);
    return done(`Approved ${formatINR(b.totalApproved)} · Spent ${formatINR(b.totalSpent)} · Remaining ${formatINR(b.totalRemaining)}\n${lines.join("\n")}`);
  }
  const waitingQ = t.match(/waiting (?:for|on) ([a-z ]+?)\??$/);
  if (/waiting/.test(t)) {
    const who = waitingQ?.[1]?.replace(/^(me|us|someone|anyone|people)$/, "").trim();
    const tasks = who && !/^(i|we)( am| are)?$/.test(who) ? filterTasks(ws.tasks, { view: "waiting", waiting: who }, ws.today) : s.waitingTasks;
    const projects = s.waitingProjects.filter((p) => !who || p.waiting_for?.toLowerCase().includes(who));
    const projectLines = projects.map((p) => `• ${p.name} – ${p.waiting_for}`).join("\n");
    const body = list(who ? `Tasks waiting for ${who}` : "Tasks waiting", tasks, ws.today, who ? `No tasks are waiting for ${who}.` : "No tasks are waiting.");
    return done(projectLines ? `Projects waiting:\n${projectLines}\n\n${body}` : body);
  }
  const withPerson = t.match(/(?:pending|open|assigned) (?:with|for|to) ([a-z ]+?)\??$/);
  if (withPerson) {
    const who = withPerson[1];
    const tasks = ws.tasks.filter((x) => x.isOpen && [x.owner, x.assigned_to, x.waiting_for].some((v) => v?.toLowerCase().includes(who)));
    return done(list(`Open items with ${who}`, tasks, ws.today, `Nothing in the system is recorded as pending with ${who}.`));
  }
  const project = resolveProject(ws, text);
  if (project && /status|update|progress|where|how|what/.test(t)) {
    const tasks = ws.tasks.filter((x) => x.project_id === project.id && !x.recurring_template_id);
    const open = tasks.filter((x) => x.isOpen || x.status === "TBD");
    return done(
      [
        `${project.name}: ${STATUS_LABEL[project.status]} (${project.priority})`,
        project.current_stage ? `Stage: ${project.current_stage}` : null,
        `Next action: ${projectNextAction(project, ws.tasks) ?? "not set"}`,
        `Waiting for: ${project.waiting_for ?? "—"}`,
        `Owner: ${project.owner ?? "not set"} · Deadline: ${project.target_date ? dueLabel(project.target_date, ws.today) : "not set"}`,
        `Budget: ${project.approved_budget === null ? "not approved yet" : `approved ${formatINR(project.approved_budget)}, spent ${formatINR(project.actual_spend)}`}`,
        `Tasks: ${tasks.filter((x) => x.status === "COMPLETED").length}/${tasks.length} done`,
        open.length ? `Open:\n${open.slice(0, 8).map((x) => `• ${x.title} [${STATUS_LABEL[x.status]}]`).join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (/pending|open|to ?do|left/.test(t)) {
    const open = filterTasks(ws.tasks, {}, ws.today);
    return done(list("Open tasks, highest priority first", open, ws.today, "No open tasks."));
  }
  return done(
    "I can answer: what’s pending, overdue, today’s priorities, what am I waiting for, status of <project>, budget remaining, manager update. Commands: “Add task: …”, “Mark … complete”, “Make … P0”, “Set … as waiting for …”, “Move … to in progress”, “Remind me about … tomorrow at 10”.",
  );
}
