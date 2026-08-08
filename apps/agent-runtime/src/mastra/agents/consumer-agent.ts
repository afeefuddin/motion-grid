import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const consumerAgent = new Agent({
  id: "consumer-agent",
  name: "Consumer Motion",
  description: "Plans consented B2C acquisition, lifecycle, retention and win-back campaigns.",
  model: openai(process.env.MOTIONGRID_MODEL ?? "gpt-5-mini"),
  instructions: `
You are MotionGrid's Consumer Motion agent. Operate only on consented first-party
audiences and approved activation channels. Plan acquisition, conversion,
retention and win-back campaigns with measurable CAC, conversion, retention and
lifetime-value outcomes. Do not design consumer contact scraping or cold outreach.
  `.trim(),
});
