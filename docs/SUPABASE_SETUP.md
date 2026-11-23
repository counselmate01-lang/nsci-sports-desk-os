# Supabase setup (database + login)

Time: about 10 minutes. Cost: free plan is enough.

## 1. Create the project
1. Go to https://supabase.com and sign in (GitHub sign-in is easiest).
2. **New project** → name `nsci-sports-desk` → choose a strong database password (save it in your password manager) → Region **Mumbai (ap-south-1)** → **Create**.
3. Wait until the project finishes setting up.

## 2. Create the tables
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261123000001_core_schema.sql` from this repository, copy everything, paste it, press **Run**. You should see "Success. No rows returned".
3. New query again → paste `supabase/migrations/20261123000002_storage.sql` → **Run**.
4. New query again → paste `supabase/seed.sql` → **Run**. This loads the 10 NSCI projects and their tasks.
5. Check: left menu → **Table Editor** → `projects` should show 10 rows.

## 3. Lock down sign-ups
1. **Authentication → Sign In / Providers**: make sure **Email** is enabled.
2. Turn **off** "Allow new users to sign up". (Only people you invite can get in.)

## 4. Tell Supabase where the app lives
**Authentication → URL Configuration**
- **Site URL**: `http://localhost:3000` for now. After deploying, change it to your Vercel address, e.g. `https://nsci-sports-desk.vercel.app`.
- **Redirect URLs**: add `http://localhost:3000/**` and (after deploying) `https://YOUR-APP.vercel.app/**`.

## 5. Fix the email links (important for invites, magic links and password resets)
**Authentication → Emails (Email Templates)**. Replace the link in each template:

| Template | Replace the `{{ .ConfirmationURL }}` link with |
|---|---|
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Magic Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

Example for "Invite user":
```html
<h2>You have been invited to NSCI Sports Desk OS</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept the invite and set your password</a></p>
```

## 6. Create your login (you become admin)
**Authentication → Users → Add user → Create new user**: your email + a password, tick **Auto Confirm User** → Create.
The first user automatically becomes **admin**.

To add teammates later: **Add user → Send invitation**. They get an email, click it, set a password. They start as **member**.
To change someone's role: **Table Editor → profiles** → edit `role` to `admin`, `member` or `viewer`.

> If someone was created *before* you ran the SQL in step 2, they will have no profile. Fix: SQL Editor → `insert into public.profiles (id, email, full_name, role) select id, email, split_part(email,'@',1), 'member' from auth.users on conflict do nothing;`

## 7. Copy the keys
**Project Settings → API Keys** (or **API**):
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**secret**: never share, never put in a NEXT_PUBLIC_ variable; only needed for n8n/WhatsApp)

Next: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
