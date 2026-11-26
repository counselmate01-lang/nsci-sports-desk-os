# Sports Desk AI setup

## What it needs
An **OpenAI API key** (separate from a ChatGPT subscription).

1. https://platform.openai.com → sign in → **Settings → Billing** → add a payment method and about $5–10 of credit.
2. **API keys → Create new secret key** → name it `nsci-sports-desk` → copy it (starts with `sk-`).
3. Add to `.env.local` and to Vercel:
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4.1-mini
   ```
   `OPENAI_MODEL` can be any current OpenAI chat model that supports tool (function) calling. A small/"mini" model is enough and cheap; the team's usage should cost a few dollars a month.
4. Restart (`npm run dev`) or redeploy. **Settings → Integrations** shows a green tick.

Recommended: in OpenAI → **Limits**, set a monthly budget cap.

## How it stays honest
- It answers only from tool results (live database). The system prompt forbids inventing anything and tells it to say "not available" when data is missing.
- It cannot write: it can only *propose* a change, which appears as a card with **Confirm / Cancel**. Cancelling, or completing a whole project, is shown in red as hard to undo.
- It has no delete ability at all.
- Confirmed changes run as the signed-in person, so viewers can't change anything.
- The key is only used on the server; the browser never sees it.

## Without a key ("basic mode")
The assistant still understands, using simple rules:
- *What is pending / overdue / today's priorities / what am I waiting for / waiting for management / pending with Shrey / status of roofing / how much budget is remaining / manager update*
- *Add task: … tomorrow, P0 · Mark … complete · Make … P0 · Set … as waiting for … · Move … to in progress · Remind me about … tomorrow at 10*

The "type a sentence" box in **New task** also works without a key.

## Example questions
- What is waiting for management approval?
- What is pending with Shrey?
- What is the status of badminton roofing?
- Give me a manager update.
- Create a task to order shuttles tomorrow.
- Mark yoga video circulation as complete.
