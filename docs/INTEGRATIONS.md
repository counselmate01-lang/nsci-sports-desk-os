# Future integrations (designed, not yet built)

The database already has what these need: `documents.external_ref` (Gmail message id / Drive file id), `doc_type = EMAIL`, `projects.aliases` for matching, and the AI engine.

## Gmail quotation detection
**Goal:** a physio quotation email arrives → classified as *Physio Sessions* → saved as a document → a "Review quotation" task is created for review. Never auto-replies or sends email.

Plan:
1. n8n **Gmail Trigger** (new email matching `quotation OR quote OR invoice OR estimate`).
2. n8n → `POST /api/integrations/email-intake` (to build) with subject, sender, snippet, message id, link.
3. The endpoint asks the AI to classify the email to one project (or "unrelated") using project names + aliases, with a confidence score.
4. If confident: insert `documents` (doc_type EMAIL or QUOTATION, `external_ref` = Gmail id, url = Gmail link) and a PENDING task "Review quotation from <sender>" in that project. If not confident: one task in an "Inbox" for a person to file.
5. Activity log records it like any other change.

Credentials needed: Google account with Gmail; n8n Gmail OAuth credential. No Google secrets go into the app.

## Google Drive organisation
**Goal:** create and link the folder structure

```
NSCI SPORTS DESK / <Project> / Quotations | Approvals | Documents ...
```
(the planned structure per project is in `src/lib/drive.ts` and shown on each project's Documents tab).

Plan: n8n Google Drive node (or a Google service account in the app) creates missing folders, writes the folder link into `projects.drive_folder_url`, and new files in a project folder are added to `documents` with `external_ref` = Drive file id.

Credentials needed: Google Drive OAuth in n8n (simplest) or a Google Cloud service account shared on the NSCI SPORTS DESK folder.

For now: paste each project's folder link via **Edit project → Google Drive folder link**.
