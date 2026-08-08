import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { businessAgent } from "./agents/business-agent";
import { consumerAgent } from "./agents/consumer-agent";
import { creatorAgent } from "./agents/creator-agent";
import { authorizeAction } from "./tools/authorize-action";
import { searchLocalBusinesses } from "./tools/search-local-businesses";
import { planCampaignWorkflow } from "./workflows/plan-campaign";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "motiongrid-runtime",
    url: process.env.MASTRA_STORAGE_URL ?? "file:./motiongrid-mastra.db",
  }),
  agents: {
    businessAgent,
    creatorAgent,
    consumerAgent,
  },
  workflows: {
    planCampaign: planCampaignWorkflow,
  },
  tools: {
    authorizeAction,
    searchLocalBusinesses,
  },
});
