# Testing checklist

Tick each item after setup. ✅ = verified by the developer on a local Supabase before handover; please re-check on your own setup.

## Login & security
- [ ] ✅ Opening the app while signed out goes to the login page
- [ ] ✅ Wrong password shows "Incorrect email or password"
- [ ] Invited teammate receives the email, sets a password, lands on the dashboard
- [ ] "Forgot password?" email works
- [ ] ✅ A `viewer` cannot edit (database rejects edits); a `member` cannot delete projects or change settings
- [ ] ✅ Nobody can change their own role
- [ ] `/api/automation/tick` without the secret returns 401 ✅

## Dashboard
- [ ] ✅ 12 numbers show; clicking a number opens the matching task list
- [ ] ✅ Active projects table shows next action, waiting for, owner, deadline, budget status
- [ ] ✅ Today's priorities / Overdue / Waiting / Recently completed / Upcoming / Budget summary
- [ ] ✅ "Open tasks have no due date" hint links to those tasks
- [ ] ✅ Works on a phone (menu button top-left)

## Projects
- [ ] ✅ 10 NSCI projects seeded with their tasks, statuses and priorities
- [ ] ✅ Tabs: Overview, Tasks (status + priority filters), Budget, Documents, Activity
- [ ] Edit project (stage, owner, waiting for, deadline, Drive link) → change appears in Activity
- [ ] New project

## Tasks
- [ ] ✅ Press `n` → New task; required fields title, project, priority, status, due date
- [ ] ✅ Sentence box: "Send court repair email tomorrow, priority P0" fills title, project (Court Repair), P0, tomorrow
- [ ] ✅ Inline status change and the round "complete" button
- [ ] ✅ Filters: view, status, priority, project, person, waiting for, due date
- [ ] ✅ "Blocked by …" shows for dependent tasks
- [ ] Task page: edit every field, add attachment link, set reminder, delete (two-click)

## Workflow rules
- [ ] ✅ Completing "Select L1" (Roofing) → next action becomes "Connect L1 with Shrey"
- [ ] ✅ Marking a Roofing quotation as L1 does the same and sets the quoted amount
- [ ] Completing the current next action of any project moves it to the next open task

## Activity log
- [ ] ✅ Status, priority, assignment, waiting for, L1 selected, budget approved, spend, task completed entries with old → new value, person and time

## Budget
- [ ] ✅ Save estimated / quoted / approved / approval status
- [ ] ✅ Recording spend above approved budget asks for confirmation; remaining turns red with a warning
- [ ] ✅ Budget page totals and dashboard totals match

## Documents
- [ ] ✅ Add a link with type, vendor, amount
- [ ] Upload a PDF; "Open file" works (needs the storage SQL from setup step 2)
- [ ] Remove a document (two-click)

## Search
- [ ] ✅ Searching "Shrey" finds tasks, the project waiting for Shrey, and the person

## Sports Desk AI
- [ ] ✅ Basic mode (no key): "What is waiting?", "Status of badminton roofing", "Mark yoga video circulation as complete" → Confirm card → saved
- [ ] ✅ "Make court repair P0", "Set roofing as waiting for Shrey", "Remind me about roofing tomorrow at 10", "Add task: Order shuttles by Wednesday"
- [ ] With OPENAI_API_KEY: every example question in docs/AI_SETUP.md; ask about something not in the system → says it's not available
- [ ] Cancel on a confirm card changes nothing

## Manager update
- [ ] ✅ Generate daily update: Completed, In Progress, Pending, Waiting For, Overdue, Upcoming, Budget, Blockers, TBD
- [ ] ✅ Edit text, Mark reviewed → WhatsApp/email buttons appear → "I've sent it" → History shows SENT
- [ ] Nothing is sent without you pressing a button

## Recurring & reminders
- [ ] ✅ Today's "Daily operations checklist" appears automatically with 6 items; ticks are saved
- [ ] ✅ Weekly review appears on Mondays
- [ ] Change morning/evening times and waiting days in Settings
- [ ] ✅ `/api/automation/tick`, `/morning`, `/evening`, `/overdue`, `/waiting-followups`, `/manager-report` respond correctly
- [ ] n8n workflow 01 imported, credentials set, emails arrive at 9:00 and 18:30

## Before each release
```bash
npm run check
```
