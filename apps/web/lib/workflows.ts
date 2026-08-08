import { mastraClient } from "./mastra-client";
import {
  SseEventSchema,
  type SseEvent,
} from "../../../src/contracts/api";
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
    const event = extractWorkflowEvent(chunk.payload);
    if (event !== null) {
      // Publishing here preserves the orchestrator's decision order for the plan UI.
      publishSseEvent(event);
    }
  }
}

function extractWorkflowEvent(value: unknown): SseEvent | null {
  const direct = SseEventSchema.safeParse(value);
  if (direct.success) {
    return direct.data;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if ("output" in value) {
    const output: SseEvent | null = extractWorkflowEvent(value.output);
    if (output !== null) {
      return output;
    }
  }
  if ("payload" in value) {
    return extractWorkflowEvent(value.payload);
  }
  return null;
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
    step: "approval-gate",
    resumeData: { approved, reviewerId: decidedBy },
  });
}
