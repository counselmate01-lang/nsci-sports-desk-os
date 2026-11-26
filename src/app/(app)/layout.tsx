import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, supabase } = await requireUser();
  // Create today's recurring tasks (daily checklist etc.). Safe to repeat: duplicates are ignored.
  if (profile && profile.role !== "viewer") {
    const tz = (await supabase.from("app_settings").select("timezone").eq("id", 1).maybeSingle()).data?.timezone ?? "Asia/Kolkata";
    await supabase.rpc("generate_recurring_tasks", { p_date: todayIn(tz) });
  }
  const ws = await getWorkspace();
  const { count } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING")
    .lte("remind_at", new Date().toISOString());

  return (
    <AppShell
      projects={ws.projects.map((p) => ({ id: p.id, name: p.name }))}
      userName={profile?.full_name || user.email || "Team member"}
      role={profile?.role ?? "viewer"}
      dueReminders={count ?? 0}
      today={ws.today}
    >
      {!profile && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Your account has no team profile yet, so you can’t see data. Ask an admin to add you (see docs/SUPABASE_SETUP.md, step 6).
        </div>
      )}
      {children}
    </AppShell>
  );
}
