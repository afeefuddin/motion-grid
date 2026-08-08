import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CampaignWorkspace, type CampaignWorkspaceView } from "@/components/campaign-workspace";

const campaignViews: CampaignWorkspaceView[] = ["plan", "targets", "approvals"];

export default async function CampaignViewPage({ params, searchParams }: { params: Promise<{ id: string; view: string }>; searchParams: Promise<{ replay?: string }> }) {
  const route = await params;
  const query = await searchParams;
  if (!campaignViews.includes(route.view as CampaignWorkspaceView)) notFound();
  return <AppShell><CampaignWorkspace campaignId={route.id} replay={query.replay === "1"} view={route.view as CampaignWorkspaceView} /></AppShell>;
}
