# Architecture

## The big picture

```
 Browser (desktop / tablet / phone)
        │  pages + forms (Next.js, React, Tailwind)
        ▼
 Next.js app on Vercel ───────────────► OpenAI API (only when Sports Desk AI is used)
   • pages render on the server
   • server actions save changes
   • /api/assistant      AI chat (tool calling)
   • /api/automation/*   called by n8n with a secret
   • /api/whatsapp/*     called by Meta (later)
        │  signed-in user's session  (Row Level Security applies)
        ▼
 Supabase
   • Postgres database: projects, tasks, documents, expenses, activity_log, reminders, reports…
   • Auth: email/password, magic links, invitations
   • Storage: private "documents" bucket for uploaded files
        ▲
        │  service-role key (server only)
 n8n (every 15 min) ──► /api/automation/tick ──► messages ──► email / WhatsApp
```

## Key decisions (in plain words)

1. **One app, no separate backend.** Next.js serves the pages and the server code. Fewer moving parts, free hosting on Vercel.
2. **The database enforces the rules.** Permissions (RLS), the activity log, "remaining budget", the L1 → "Connect L1 with Shrey" rule and recurring-task creation all live in Postgres. Whatever changes a task (web page, AI, WhatsApp, n8n), the same rules apply and nothing is missed.
3. **Load once, compute in code.** The Sports Desk has tens of projects and hundreds of tasks, so each page loads projects and tasks once and works out overdue / waiting / blocked / dashboard numbers in TypeScript (`src/lib/data`). The dashboard, filters, reports and AI all use the same functions, so they always agree.
4. **The AI can only read through tools.** Sports Desk AI uses OpenAI tool calling. It can call `get_overview`, `list_tasks`, `get_project`, `get_budget`, `generate_manager_update`. It cannot write directly: `propose_*` tools only create a confirmation card. The person presses Confirm, then the change runs as that person (so permissions apply). It has no delete tool.
5. **Basic mode without AI.** A rule-based parser understands the common questions and commands, so the assistant and the "type a sentence" task box still work without an OpenAI key or if OpenAI is down.
6. **Reports are built, not written by AI.** The manager update is assembled directly from the database, so it cannot contain invented facts. You edit it before sending.
7. **Reminder times live in the app.** n8n calls one endpoint every 15 minutes; the app decides whether the 9:00 AM or 6:30 PM digest is due based on Settings. Changing a time in Settings is enough.

## Database schema

| Table | Purpose | Main columns |
|---|---|---|
| `profiles` | Team members (one per login) | full_name, email, phone, role (admin/member/viewer) |
| `projects` | The 10 NSCI projects and new ones | name, description, status, priority, owner, start_date, target_date, estimated_budget, quoted_amount, approved_budget, actual_spend, **remaining_budget** (calculated), budget_status, waiting_for, current_stage, next_action, drive_folder_url, aliases |
| `tasks` | Every task | title, description, project_id, status, priority, owner, assigned_to, due_date, start_date, waiting_for, waiting_since, dependency, depends_on_task_id, next_action, next_task_id, estimated_budget, approved_budget, actual_spend, notes, checklist, recurring_template_id, created_at, updated_at, completed_at |
| `documents` | Links, uploaded files, quotations (task attachments too) | project_id, task_id, title, doc_type, url, storage_path, vendor, amount, is_l1, notes, external_ref |
| `expenses` | Actual spend entries | project_id, task_id, description, amount, spent_on, vendor |
| `activity_log` | History (written by triggers only) | project_id, task_id, action, field, previous_value, new_value, actor_name, created_at |
| `recurring_templates` | Daily checklist, weekly review… | frequency, weekday, month_day, interval_days, checklist, start_date, active |
| `reminders` | Personal reminders and waiting follow-ups | title, remind_at, kind, status, task_id, project_id |
| `reports` | Saved manager updates and sent digests | report_type, content, status (DRAFT/REVIEWED/SENT) |
| `app_settings` | Reminder times, waiting days, time zone | single row |
| `pending_actions` | WhatsApp changes waiting for "YES" | server-only |

Statuses: PENDING, IN_PROGRESS, WAITING, COMPLETED, CANCELLED, TBD. Priorities: P0 Urgent, P1 Important, P2 Normal, P3 Future.

Automatic behaviour (database triggers):
- `completed_at` set/cleared with status; `waiting_since` set when a task starts waiting (drives follow-ups).
- Activity log rows for status, priority, assignment, owner, waiting-for, due date, title, dependency, next action, budgets, stage, deadline, Drive folder, budget approval, documents, L1 selection, spend.
- Task completed/cancelled → project next action moves to the task's "next task" (workflow rule) or the next open task.
- Quotation marked L1 → "Select L1" task completed + project quoted amount set.
- Spend entries keep `projects.actual_spend` up to date.
- `generate_recurring_tasks(date)` creates each day's recurring tasks (no duplicates).

## Security

- Supabase Auth; public sign-up disabled; invite-only. First user becomes admin.
- Row Level Security on every table. `anon` (not signed in) has no access at all.
- Users cannot change their own role (column-level grants).
- Service-role key only used in `src/lib/supabase/admin.ts`, imported only by automation and WhatsApp routes, which check their own secrets.
- Secrets only in environment variables (`.env.local` is git-ignored).
- Server-side validation of every form and AI action (zod).
- File uploads: private bucket, 20 MB limit, downloads via 10-minute signed links.

## Roadmap

| Step | Status |
|---|---|
| 1 Architecture & schema | Done (this file) |
| 2 Project structure | Done |
| 3 Authentication | Done |
| 4 Schema, migrations, seed | Done |
| 5 Dashboard | Done |
| 6 Projects | Done |
| 7 Tasks | Done |
| 8 Activity log | Done |
| 9 Budget | Done |
| 10 AI assistant | Done (needs OPENAI_API_KEY for full mode) |
| 11 Manager reports | Done |
| 12 Recurring tasks / reminders | Done (delivery needs n8n) |
| 13 n8n automation | Workflows in `/n8n`, guide in docs/N8N.md |
| 14 WhatsApp architecture | Webhook built, off until credentials added |
| Next | Gmail quotation intake, Google Drive folder creation (docs/INTEGRATIONS.md) |
