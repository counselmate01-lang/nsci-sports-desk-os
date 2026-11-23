# Reminders and automation with n8n

The app works out *what* to send; n8n *delivers* it (email now, WhatsApp later). Nothing is sent to your manager automatically; manager updates are only drafted.

## 1. Prepare the app
Add to Vercel (and `.env.local`):
```
SUPABASE_SERVICE_ROLE_KEY=...        (Supabase → Project Settings → API Keys → service_role / secret)
AUTOMATION_SECRET=...                (make one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```
Redeploy. Test (replace the address and secret):
```bash
curl -X POST https://YOUR-APP.vercel.app/api/automation/tick -H "Authorization: Bearer YOUR_AUTOMATION_SECRET"
```
You should get `{"now": "...", "recurring_created": 0, "messages": [...]}`.

## 2. Set up n8n
Use n8n Cloud (https://n8n.io, has a free trial) or self-host.

1. **Settings → Variables** (or environment variables if self-hosting), add:
   - `NSCI_APP_URL` = `https://YOUR-APP.vercel.app`
   - `NSCI_NOTIFY_EMAIL` = where reminders go
   - `NSCI_FROM_EMAIL` = sender address
2. **Credentials → New → Header Auth**, name it **NSCI automation**: Name `Authorization`, Value `Bearer YOUR_AUTOMATION_SECRET`.
3. **Credentials → New → SMTP** (or swap the email node for Gmail / Outlook nodes).
4. **Workflows → Import from file** → `n8n/01-reminders-tick.json`. Open each node with a red warning and pick your credentials. **Activate**.

That one workflow does everything, every 15 minutes:

| What | When |
|---|---|
| Morning digest: P0, due today, overdue, important waiting | first run after the morning time in Settings (default 9:00) |
| Evening digest: completed today, still pending, overdue, carry-forward | first run after the evening time (default 18:30) |
| Waiting follow-ups (creates a reminder in the app too) | tasks waiting longer than the days set in Settings (default 3) |
| Personal reminders ("Remind me…") | when due |
| Recurring tasks (daily checklist etc.) | created for the day |

Change times in the app (**Settings → Reminders**), not in n8n.

## Other workflows
- `n8n/02-separate-jobs.json`: the same jobs on fixed separate schedules. Use this **instead of** 01, not together (you'd get duplicates).
- `n8n/03-manager-report-draft.json`: weekdays 17:30, creates a manager update **draft** in the app and emails you "draft ready". You review and send it from **Reports**.

## Endpoints (all `POST`, all need `Authorization: Bearer AUTOMATION_SECRET`)
| URL | Returns |
|---|---|
| `/api/automation/tick` | everything that is due now |
| `/api/automation/morning` | morning digest (always, for testing) |
| `/api/automation/evening` | evening digest |
| `/api/automation/overdue` | overdue list |
| `/api/automation/waiting-followups` | creates follow-ups |
| `/api/automation/due-reminders` | personal reminders now due |
| `/api/automation/recurring` | creates today's recurring tasks |
| `/api/automation/manager-report?kind=DAILY` | saves a draft report |

Each returns `{ "messages": [ { "type", "title", "text" } ] }`; the workflow sends one email per message.

## Future workflows (designed, not built)
- **WhatsApp inbound**: not needed in n8n; Meta calls the app's webhook directly (docs/WHATSAPP.md).
- **Gmail quotation detection** and **Google Drive organisation**: see docs/INTEGRATIONS.md.
