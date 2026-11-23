import type { Metadata } from "next";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardBody, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/badges";
import { ProfileForm, ReminderSettingsForm, RunRecurringButton, TemplateForm, TemplateRow } from "@/components/settings/settings-forms";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/data/load";
import { isAIConfigured, isWhatsAppConfigured, serverEnv } from "@/lib/env";
import type { Profile, RecurringTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, profile, user } = await requireUser();
  const ws = await getWorkspace();
  const [tplRes, teamRes] = await Promise.all([
    supabase.from("recurring_templates").select("*").order("created_at").returns<RecurringTemplate[]>(),
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
  ]);
  const isAdmin = profile?.role === "admin";
  const canEdit = profile?.role !== "viewer";
  const projects = ws.projects.map((p) => ({ id: p.id, name: p.name }));
  const projectName = new Map(ws.projects.map((p) => [p.id, p.name]));
  const env = serverEnv();

  const integrations = [
    { name: "Supabase database & login", ok: true, note: "Connected" },
    { name: "OpenAI (Sports Desk AI)", ok: isAIConfigured(), note: isAIConfigured() ? `Model: ${env.openaiModel}` : "Add OPENAI_API_KEY. Basic mode is used until then." },
    { name: "n8n automation endpoints", ok: Boolean(env.automationSecret && env.serviceRoleKey), note: env.automationSecret && env.serviceRoleKey ? "Ready for n8n" : "Add AUTOMATION_SECRET and SUPABASE_SERVICE_ROLE_KEY" },
    { name: "WhatsApp Cloud API", ok: isWhatsAppConfigured(), note: isWhatsAppConfigured() ? "Webhook active" : "Later: see docs/WHATSAPP.md" },
    { name: "Gmail quotation detection", ok: false, note: "Later: see docs/INTEGRATIONS.md" },
    { name: "Google Drive folders", ok: false, note: "Later: paste folder links on each project for now" },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reminders" description={`Times are in ${ws.settings.timezone}. Delivered by n8n (see docs/N8N.md).`} />
          <CardBody>
            <ReminderSettingsForm settings={ws.settings} isAdmin={isAdmin} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="My profile" description={user.email ?? undefined} />
          <CardBody>
            <ProfileForm name={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recurring tasks" description="Created automatically each day they are due (daily checklist, weekly review, monthly report…)" action={canEdit && <RunRecurringButton />} />
          {tplRes.data?.length ? (
            <ul className="divide-y divide-slate-100">
              {tplRes.data.map((t) => (
                <TemplateRow key={t.id} t={t} projectName={projectName.get(t.project_id) ?? ""} projects={projects} today={ws.today} canEdit={canEdit} />
              ))}
            </ul>
          ) : (
            <Empty>No recurring tasks.</Empty>
          )}
          {canEdit && (
            <details className="border-t border-slate-100 px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-brand-700">Add a recurring task</summary>
              <div className="mt-3">
                <TemplateForm projects={projects} today={ws.today} />
              </div>
            </details>
          )}
        </Card>
        <Card>
          <CardHeader title="Team" description="Invite people from Supabase → Authentication → Users → Invite. Change roles in the profiles table." />
          <ul className="divide-y divide-slate-100">
            {(teamRes.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <span>
                  <span className="font-medium">{p.full_name ?? p.email}</span>
                  <span className="block text-xs text-slate-500">{p.email}</span>
                </span>
                <Tag tone={p.role === "admin" ? "blue" : "slate"}>{p.role}</Tag>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Integrations" />
          <ul className="divide-y divide-slate-100">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-start gap-3 px-4 py-2.5">
                {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <CircleDashed className="mt-0.5 h-4 w-4 text-slate-400" />}
                <span>
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-xs text-slate-500">{i.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
