# Run it on your computer

## One-time installs
1. **Node.js 20 or newer** (LTS): https://nodejs.org → download → install. Check in Terminal: `node -v`
2. **Git**: macOS has it (type `git --version`; accept the install prompt). Windows: https://git-scm.com/download/win

## Get the code
```bash
git clone https://github.com/counselmate01-lang/nsci-sports-desk-os.git
cd nsci-sports-desk-os
npm install
```

## Add your settings
```bash
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
```
Open `.env.local` in any text editor and fill in at least:
```
NEXT_PUBLIC_SUPABASE_URL=...      (from Supabase step 7)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
Optional now: `OPENAI_API_KEY` (AI), `SUPABASE_SERVICE_ROLE_KEY` + `AUTOMATION_SECRET` (n8n).

## Start
```bash
npm run dev
```
Open http://localhost:3000 and sign in with the user you created in Supabase.

Stop with `Ctrl + C`. After changing `.env.local`, stop and start again.

## Checks before sharing changes
```bash
npm run check     # TypeScript + lint + production build
```

## Optional: a private local database (for developers)
Needs Docker Desktop. Runs a full Supabase on your machine with the schema and seed loaded:
```bash
npx supabase start      # prints a local URL and keys; put them in .env.local
npx supabase db reset   # wipe and reload schema + seed any time
npx supabase stop
```
