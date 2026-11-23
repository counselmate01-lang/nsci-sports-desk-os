# Put it online with Vercel

1. Go to https://vercel.com → sign in with GitHub (the account that can see `counselmate01-lang/nsci-sports-desk-os`).
2. **Add New → Project** → find `nsci-sports-desk-os` → **Import**.
3. Framework is detected as **Next.js**. Leave build settings as they are.
4. Open **Environment Variables** and add (values from `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (if using n8n/WhatsApp)
   - `OPENAI_API_KEY`, `OPENAI_MODEL` (if using AI)
   - `AUTOMATION_SECRET` (if using n8n)
   - `APP_URL` = your Vercel address (you can add it after the first deploy)
5. **Deploy**. After a minute you get an address like `https://nsci-sports-desk-os.vercel.app`.
6. Back in Supabase → **Authentication → URL Configuration**: set **Site URL** to that address and add `https://YOUR-ADDRESS/**` to **Redirect URLs**.
7. Open the address and sign in.

Every push to the `main` branch redeploys automatically. Pull requests get their own preview address.

Check it's healthy: open `https://YOUR-ADDRESS/api/health` → `{"ok":true,"supabase":true,...}`.

If you change an environment variable in Vercel: **Deployments → … → Redeploy**.
