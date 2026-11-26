# WhatsApp integration (later)

**Status:** the webhook is built and secured but switched **off** until all WhatsApp variables are set. Do this only after the web app is working well.

## How it works
```
You (WhatsApp) → Meta WhatsApp Cloud API → POST /api/whatsapp/webhook
   → checks Meta's signature and that your number is allow-listed
   → Sports Desk AI (same engine as the web assistant, read-only tools)
   → questions: answered immediately
   → changes: bot replies with a summary + "Reply YES to confirm"
   → YES → change saved → "Done. … updated."
```
Examples: "What's pending?" · "Mark shuttle order complete." → YES · "Remind me about roofing tomorrow at 10." → YES.

Changes from WhatsApp show as **System** in the activity log (the webhook acts on behalf of the team, not a logged-in user).

## What you need (credentials)
1. A **Meta for Developers** account: https://developers.facebook.com → **My Apps → Create App → Business** → add the **WhatsApp** product.
2. A phone number for the bot (Meta gives a free test number; a real number needs Meta Business verification).
3. From the app's WhatsApp → **API Setup** page:
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_ACCESS_TOKEN`: create a **permanent System User token** in Meta Business Settings (the temporary one expires in 24 h)
4. App → **Settings → Basic → App Secret** → `WHATSAPP_APP_SECRET`
5. Make up a random `WHATSAPP_VERIFY_TOKEN` (any long string).
6. `WHATSAPP_ALLOWED_NUMBERS`: your team's numbers with country code, digits only, comma separated (e.g. `919876543210`). Messages from other numbers are ignored.

Add all of them to Vercel → redeploy.

## Connect the webhook
Meta app → **WhatsApp → Configuration → Webhook → Edit**:
- Callback URL: `https://YOUR-APP.vercel.app/api/whatsapp/webhook`
- Verify token: your `WHATSAPP_VERIFY_TOKEN`
- **Verify and save**, then subscribe to the **messages** field.

Send "What's pending?" from an allowed number.

## Limits to know
- The bot can reply freely within 24 hours of your last message to it. To **start** a conversation (e.g. 9 AM reminders by WhatsApp), Meta requires an approved **message template**; the n8n WhatsApp node is disabled until you have one.
- One change is confirmed at a time; confirmations expire after 15 minutes.
