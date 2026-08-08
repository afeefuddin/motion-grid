import { AppShell } from "@/components/app-shell";
import { CampaignWorkspace } from "@/components/campaign-workspace";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ replay?: string }> }) {
  const route = await params;
  const query = await searchParams;
  return <AppShell><CampaignWorkspace campaignId={route.id} replay={query.replay === "1"} view="chat" /></AppShell>;
}
