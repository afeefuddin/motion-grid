import { mastraClient } from "./mastra-client";

const CAMPAIGN_WORKFLOW_ID = "campaignWorkflow";

/** Dispatches a persisted run to Mastra; Next.js never owns its lifetime. */
export async function startCampaignWorkflow(
  runId: string,
  inputData: Record<string, unknown>,
) {
  const workflow = mastraClient.getWorkflow(CAMPAIGN_WORKFLOW_ID);
  const run = await workflow.createRun({ runId });
  await run.start({ inputData });
  return { message: "Campaign workflow dispatched to Mastra." };
}
/** Stops a persisted campaign run, including work suspended for approval. */
export async function cancelCampaignWorkflow(runId: string) {
  const workflow = mastraClient.getWorkflow(CAMPAIGN_WORKFLOW_ID);
  const workflowRun = await workflow.createRun({ runId });
  return workflowRun.cancel();
}
