import { mastraClient } from "./mastra-client";
import { SseEventSchema } from "../../../src/contracts/api";
import { publishSseEvent } from "./sse";

const CAMPAIGN_WORKFLOW_ID = "campaignWorkflow";

/** Starts a persisted Mastra campaign run without holding the API request open. */
export async function startCampaignWorkflow(
  runId: string,
  inputData: Record<string, unknown>,
) {
  const workflow = mastraClient.getWorkflow(CAMPAIGN_WORKFLOW_ID);
  const run = await workflow.createRun({ runId });
  const stream = await run.stream({ inputData, closeOnSuspend: true });
  void forwardWorkflowEvents(stream);
  return { message: "Campaign workflow started." };
}

async function forwardWorkflowEvents(
  stream: ReadableStream<{ payload: unknown }>,
) {
  for await (const chunk of stream) {
    const event = SseEventSchema.safeParse(chunk.payload);
    if (event.success) {
      // Publishing here preserves the orchestrator's decision order for the plan UI.
      publishSseEvent(event.data);
    }
  }
}

/** Resumes the campaign approval suspension with the user's decision. */
export async function resumeCampaignWorkflow(
  runId: string,
  approved: boolean,
  decidedBy: string,
) {
  const workflow = mastraClient.getWorkflow(CAMPAIGN_WORKFLOW_ID);
  const run = await workflow.createRun({ runId });
  return run.resume({
    resumeData: { approved, decidedBy },
  });
}
