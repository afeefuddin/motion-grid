import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const creatorAgent = new Agent({
  id: "creator-agent",
  name: "Creator Motion",
  description: "Plans creator partnerships and attributable distribution campaigns.",
  model: openai(process.env.MOTIONGRID_MODEL ?? "gpt-5-mini"),
  instructions: `
You are MotionGrid's Creator Motion agent. Plan creator discovery, qualification,
partnership design, approved outreach, deliverables, disclosure, and attribution.
Optimize for profitable partnerships and measured outcomes, not contact volume.
Never perform external actions without a deterministic policy check and approval.
  `.trim(),
});
