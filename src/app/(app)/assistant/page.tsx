import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { AssistantChat } from "@/components/assistant/chat";
import { requireUser } from "@/lib/auth";
import { isAIConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sports Desk AI" };

export default async function AssistantPage() {
  const { profile } = await requireUser();
  return (
    <>
      <PageHeader title="Sports Desk AI" description="Answers from your live data. Never invents information. Every change needs your confirmation." />
      <AssistantChat aiEnabled={isAIConfigured()} canEdit={profile?.role !== "viewer"} />
    </>
  );
}
