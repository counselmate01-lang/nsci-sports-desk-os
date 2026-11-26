import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-xl font-semibold">NSCI Sports Desk OS – setup needed</h1>
      <p className="mt-2 text-slate-600">
        The app is running, but it is not connected to a Supabase database yet.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
        <li>Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to <code className="rounded bg-slate-100 px-1">.env.local</code>.</li>
        <li>Fill in <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> from Supabase → Project Settings → API.</li>
        <li>Restart the app (<code className="rounded bg-slate-100 px-1">npm run dev</code>). On Vercel, add the same variables under Settings → Environment Variables and redeploy.</li>
      </ol>
      <p className="mt-4 text-slate-600">Full steps are in <code className="rounded bg-slate-100 px-1">docs/SUPABASE_SETUP.md</code>.</p>
    </div>
  );
}
