# NSCI Sports Desk OS

One place for the NSCI Sports Desk team's projects, tasks, budgets, documents, reminders and manager updates, replacing scattered WhatsApp messages, Excel files and manual reminders.

Every active project always shows: **current status, next action, who is responsible, who we're waiting for, deadline, budget and documents.**

## What's in this version (MVP)

| Area | What works |
|---|---|
| Login | Supabase email + password, magic link, invite-only, password reset. Roles: admin / member / viewer |
| Dashboard | 12 key numbers, active projects with next actions, Today's priorities, Overdue, Waiting for, Recently completed, Upcoming, Budget summary, reminders due |
| Projects | List + page with Overview, Tasks, Budget, Documents, Activity tabs. All 10 NSCI projects seeded |
| Tasks | Fast "New task" (press `n`), optional sentence input ("Send court repair email tomorrow, P0"), all fields from the brief, inline status change, filters (project, status, priority, owner, due date, waiting for, overdue, completed, blocked) |
| Workflow rules | Completing a task moves the project's next action on. Selecting the L1 quotation completes "Select L1", so the next action becomes "Connect L1 with Shrey" |
| Dependencies | "Depends on task" (shows *Blocked by …*) and free-text dependency |
| Activity log | Written by the database itself for every important change: who, what, old value, new value, when |
| Budget | Estimated, quoted, approved, spent (from spend entries), remaining = approved − spent; warnings before going negative; pending approvals |
| Documents | Links (Drive, Sheets, email) and file uploads (private Supabase Storage), quotations with vendor/amount, L1 selection, planned Drive folder structure |
| Search | Projects, tasks, people, notes, statuses, waiting-for values, documents |
| Sports Desk AI | Answers only from the database (OpenAI tool calling). Never saves anything without a Confirm click. Works in "basic mode" without an OpenAI key |
| Manager update | Generate → Review/edit → Copy / open in WhatsApp / email → mark sent. Never sent automatically |
| Recurring tasks | Daily operations checklist, weekly review, monthly report; daily/weekly/monthly/every N days |
| Reminders | 9:00 AM and 6:30 PM digests, waiting follow-ups after N days, personal reminders. Times configurable in Settings. Delivered by n8n |
| Calendar | Month view of due dates and project deadlines |
| WhatsApp | Webhook built and secured, **off until you add credentials** (docs/WHATSAPP.md) |

Not built yet (by design, after the core works): Gmail quotation detection, Google Drive API, automatic WhatsApp sending. Designs are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Quick start (about 20 minutes)

1. **Supabase** – create the database and your login: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
2. **Run it on your computer** – [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
3. **Put it online** – [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)
4. Optional: **AI** [docs/AI_SETUP.md](docs/AI_SETUP.md) · **Reminders via n8n** [docs/N8N.md](docs/N8N.md) · **WhatsApp later** [docs/WHATSAPP.md](docs/WHATSAPP.md)

Then work through [docs/TESTING_CHECKLIST.md](docs/TESTING_CHECKLIST.md).

## Commands

```bash
npm install          # once, installs everything
npm run dev          # run locally at http://localhost:3000
npm run typecheck    # TypeScript check
npm run lint         # code style check
npm run build        # production build (what Vercel runs)
npm run check        # all three above
```

## Folder structure

```
src/
  app/
    (app)/            pages behind login: dashboard, projects, tasks, calendar,
                      budget, documents, assistant, reports, settings, search
    actions/          server actions (create/update tasks, projects, budget, documents…)
    api/
      assistant/      Sports Desk AI chat, confirm/execute, sentence → task fields
      automation/     n8n endpoints (tick, morning, evening, overdue, waiting-followups…)
      whatsapp/       WhatsApp Cloud API webhook (off until configured)
    login, auth/      sign-in, invite/magic-link confirmation, set password, sign out
  components/         UI (ui/ = basic building blocks)
  lib/
    data/             loads projects + tasks, dashboard numbers, filters
    ai/               assistant engine, tools, rule-based parser, confirmable actions
    reports.ts        manager update + morning/evening digests
    automation.ts     reminder logic used by n8n
supabase/
  migrations/         database schema, triggers, Row Level Security, storage
  seed.sql            the NSCI projects and tasks
n8n/                  importable n8n workflows
docs/                 setup guides, architecture, testing checklist
```

## Security in one paragraph

Everything requires login; sign-ups are invite-only. Every table has Row Level Security: viewers read, members read and write, only admins delete projects or change settings, and nobody can change their own role. The browser only ever gets the public "anon" key; the service-role key, OpenAI key, automation secret and WhatsApp tokens live only on the server (environment variables, never committed). All input is validated (zod) on the server. Automation endpoints need a secret bearer token; the WhatsApp webhook checks Meta's signature and an allow-list of phone numbers. The AI cannot delete anything and cannot save without a confirmation.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
