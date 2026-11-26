import { dashboardStats } from "@/lib/data/stats";
import { filterTasks } from "@/lib/data/filter";
import { projectNextAction, type Workspace } from "@/lib/data/workspace";
import { buildManagerUpdate } from "@/lib/reports";
import type { TaskView } from "@/lib/types";
import { proposal, type ProposedAction } from "./actions";
import { findTasks, resolveProject } from "./resolve";

// Tools the AI can call. Read tools only return database data. "propose_*"
// tools never change anything: they queue a change for the person to confirm.

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description: "Counts and lists for today: P0 tasks, overdue, due today, waiting, budget totals, pending approvals, active projects with next actions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "Search and filter tasks. Use 'query' to find tasks by words in the title (e.g. 'yoga video'). Use 'person' for anything with someone (owner, assigned or waiting for). Returns task ids you can use in propose_update_task.",
      parameters: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["open", "today", "week", "overdue", "waiting", "blocked", "nodate", "completed", "all"] },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED", "TBD"] },
          priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
          project: { type: "string", description: "Project name or nickname" },
          person: { type: "string", description: "Name, e.g. Shrey, Paul, Management" },
          waiting_for: { type: "string" },
          query: { type: "string", description: "Words from the task title" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description: "Full status of one project: status, stage, next action, owner, waiting for, deadline, budget, all tasks.",
      parameters: {
        type: "object",
        properties: { project: { type: "string", description: "Project name or nickname, e.g. 'roofing'" } },
        required: ["project"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget",
      description: "Budget totals, per-project estimated/quoted/approved/spent/remaining, pending approvals and over-budget projects.",
      parameters: { type: "object", properties: { project: { type: "string" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_manager_update",
      description: "Builds the manager update text (Completed / In Progress / Pending / Waiting / Overdue / Upcoming / Budget / Blockers) from the database.",
      parameters: { type: "object", properties: { kind: { type: "string", enum: ["DAILY", "WEEKLY"] } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_task",
      description: "Queue a new task for the person to confirm. Resolve relative dates (tomorrow, Wednesday) to YYYY-MM-DD yourself. If no due date was given, use today.",
      parameters: {
        type: "object",
        properties: {
          project: { type: "string" },
          title: { type: "string" },
          priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "WAITING", "TBD"] },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          waiting_for: { type: "string" },
          assigned_to: { type: "string" },
          notes: { type: "string" },
        },
        required: ["project", "title", "due_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_task",
      description: "Queue a change to an existing task (by task_id from list_tasks) for the person to confirm. Use an empty string to clear waiting_for/assigned_to.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED", "TBD"] },
          priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
          due_date: { type: "string" },
          waiting_for: { type: "string" },
          assigned_to: { type: "string" },
          owner: { type: "string" },
          title: { type: "string" },
          notes_append: { type: "string" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_project",
      description: "Queue a change to a project (status, priority, waiting for, next action, stage, owner, deadline, budget approval status) for the person to confirm.",
      parameters: {
        type: "object",
        properties: {
          project: { type: "string" },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED", "TBD"] },
          priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
          waiting_for: { type: "string" },
          next_action: { type: "string" },
          current_stage: { type: "string" },
          owner: { type: "string" },
          target_date: { type: "string" },
          budget_status: { type: "string", enum: ["NOT_STARTED", "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "NOT_REQUIRED"] },
        },
        required: ["project"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_reminder",
      description: "Queue a reminder for the person to confirm. Date YYYY-MM-DD and 24h time HH:MM in the team's time zone.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          project: { type: "string" },
          task_id: { type: "string" },
        },
        required: ["title", "date", "time"],
        additionalProperties: false,
      },
    },
  },
] as const;

export function taskSummary(t: TaskView) {
  return {
    task_id: t.id,
    title: t.title,
    project: t.projectName,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    overdue: t.isOverdue || undefined,
    waiting_for: t.waiting_for ?? undefined,
    waiting_days: t.waitingDays ?? undefined,
    assigned_to: t.assigned_to ?? undefined,
    owner: t.owner ?? undefined,
    blocked_by: t.blockedBy?.title,
    dependency: t.dependency ?? undefined,
    completed_at: t.completed_at ?? undefined,
  };
}

const MAX = 40;

export interface ToolContext {
  ws: Workspace;
  proposals: ProposedAction[];
}

type Args = Record<string, string | undefined>;

export function runTool(name: string, args: Args, ctx: ToolContext): unknown {
  const { ws } = ctx;
  switch (name) {
    case "get_overview": {
      const s = dashboardStats(ws);
      return {
        today: ws.today,
        counts: {
          projects: s.totalProjects,
          active_tasks: s.activeTasks,
          p0_open: s.highPriority.length,
          overdue: s.overdue.length,
          due_today: s.dueToday.length,
          due_this_week: s.dueThisWeek.length,
          waiting_tasks: s.waitingTasks.length,
          completed_total: s.completedCount,
          open_tasks_without_due_date: s.noDueDate.length,
        },
        todays_priorities: s.todaysPriorities.slice(0, 15).map(taskSummary),
        overdue: s.overdue.slice(0, 15).map(taskSummary),
        waiting_projects: s.waitingProjects.map((p) => ({ project: p.name, waiting_for: p.waiting_for })),
        waiting_tasks: s.waitingTasks.slice(0, 15).map(taskSummary),
        active_projects: s.activeProjects.map((p) => ({
          project: p.name,
          status: p.status,
          priority: p.priority,
          stage: p.current_stage,
          next_action: projectNextAction(p, ws.tasks),
          waiting_for: p.waiting_for,
          deadline: p.target_date,
        })),
        budget: s.budget && {
          approved: s.budget.totalApproved,
          spent: s.budget.totalSpent,
          remaining: s.budget.totalRemaining,
          pending_approval_amount: s.budget.pendingApprovalAmount,
          pending_approval_projects: s.pendingApprovalProjects.map((p) => p.name),
        },
      };
    }
    case "list_tasks": {
      let tasks = ws.tasks;
      let projectNote: string | undefined;
      if (args.project) {
        const p = resolveProject(ws, args.project);
        if (!p) return { error: `No project matches “${args.project}”.`, projects: ws.projects.map((x) => x.name) };
        tasks = tasks.filter((t) => t.project_id === p.id);
        projectNote = p.name;
      }
      if (args.query) {
        const found = findTasks(ws, args.query, {});
        const ids = new Set(found.map((t) => t.id));
        tasks = tasks.filter((t) => ids.has(t.id));
      }
      if (args.person) {
        const who = args.person.toLowerCase();
        tasks = tasks.filter((t) => [t.owner, t.assigned_to, t.waiting_for].some((v) => v?.toLowerCase().includes(who)));
      }
      const view = args.view === "open" ? "" : args.view ?? (args.query ? "all" : "");
      const result = filterTasks(tasks, { view, status: args.status, priority: args.priority, waiting: args.waiting_for }, ws.today);
      const waitingProjects =
        args.waiting_for || args.person
          ? ws.projects
              .filter((p) => p.waiting_for?.toLowerCase().includes((args.waiting_for ?? args.person)!.toLowerCase()))
              .map((p) => ({ project: p.name, waiting_for: p.waiting_for, status: p.status }))
          : undefined;
      return {
        project: projectNote,
        total: result.length,
        tasks: result.slice(0, MAX).map(taskSummary),
        truncated: result.length > MAX || undefined,
        projects_waiting: waitingProjects?.length ? waitingProjects : undefined,
      };
    }
    case "get_project": {
      const p = resolveProject(ws, args.project);
      if (!p) return { error: `No project matches “${args.project}”.`, projects: ws.projects.map((x) => x.name) };
      const tasks = ws.tasks.filter((t) => t.project_id === p.id && !t.recurring_template_id).sort((a, b) => a.sort_order - b.sort_order);
      return {
        project: p.name,
        status: p.status,
        priority: p.priority,
        stage: p.current_stage,
        next_action: projectNextAction(p, ws.tasks),
        owner: p.owner,
        waiting_for: p.waiting_for,
        deadline: p.target_date,
        description: p.description,
        drive_folder: p.drive_folder_url,
        budget: {
          status: p.budget_status,
          estimated: p.estimated_budget,
          quoted: p.quoted_amount,
          approved: p.approved_budget,
          spent: p.actual_spend,
          remaining: p.approved_budget === null ? null : p.remaining_budget,
        },
        tasks: tasks.map(taskSummary),
      };
    }
    case "get_budget": {
      const s = dashboardStats(ws);
      const list = args.project ? [resolveProject(ws, args.project)].filter(Boolean) : ws.projects;
      if (args.project && !list.length) return { error: `No project matches “${args.project}”.` };
      return {
        totals: {
          approved: s.budget.totalApproved,
          spent: s.budget.totalSpent,
          remaining: s.budget.totalRemaining,
          estimated: s.budget.totalEstimated,
          pending_approval_amount: s.budget.pendingApprovalAmount,
        },
        projects: list.map((p) => ({
          project: p!.name,
          status: p!.budget_status,
          estimated: p!.estimated_budget,
          quoted: p!.quoted_amount,
          approved: p!.approved_budget,
          spent: p!.actual_spend,
          remaining: p!.approved_budget === null ? null : p!.remaining_budget,
        })),
        over_budget: s.budget.overBudget.map((p) => p.name),
        note: s.budget.totalApproved === 0 && s.budget.totalSpent === 0 ? "No budget figures have been entered yet." : undefined,
      };
    }
    case "generate_manager_update":
      return buildManagerUpdate(ws, args.kind === "WEEKLY" ? "WEEKLY" : "DAILY");

    case "propose_create_task": {
      const p = resolveProject(ws, args.project);
      if (!p) return { error: `No project matches “${args.project}”. Ask which project.`, projects: ws.projects.map((x) => x.name) };
      return queue(ctx, {
        type: "create_task",
        project_id: p.id,
        title: args.title,
        priority: args.priority ?? "P2",
        status: args.status ?? (args.waiting_for ? "WAITING" : "PENDING"),
        due_date: args.due_date || ws.today,
        waiting_for: args.waiting_for,
        assigned_to: args.assigned_to,
        notes: args.notes,
      });
    }
    case "propose_update_task": {
      const { task_id, ...rest } = args;
      const changes = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      return queue(ctx, { type: "update_task", task_id, changes });
    }
    case "propose_update_project": {
      const p = resolveProject(ws, args.project);
      if (!p) return { error: `No project matches “${args.project}”.`, projects: ws.projects.map((x) => x.name) };
      const { project: _ignored, ...rest } = args;
      void _ignored;
      const changes = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      return queue(ctx, { type: "update_project", project_id: p.id, changes });
    }
    case "propose_reminder": {
      const p = args.project ? resolveProject(ws, args.project) : null;
      return queue(ctx, {
        type: "create_reminder",
        title: args.title,
        date: args.date,
        time: args.time,
        task_id: args.task_id || null,
        project_id: p?.id ?? null,
      });
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function queue(ctx: ToolContext, raw: unknown) {
  const p = proposal(ctx.ws, raw);
  if ("error" in p) return { error: p.error };
  ctx.proposals.push(p);
  return { queued: true, summary: p.summary, note: "Not saved yet. The person must press Confirm." };
}
