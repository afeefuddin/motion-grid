import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { agentRegistry } from "./agents";
import { createDefaultCampaignWorkflow } from "./workflows";

declare global {
  var motionGridMastra: Mastra | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Mastra");
}

export const mastra =
  globalThis.motionGridMastra ??
  new Mastra({
    agents: agentRegistry,
    workflows: { campaignWorkflow: createDefaultCampaignWorkflow() },
    storage: new PostgresStore({
      id: "motiongrid-storage",
      connectionString: databaseUrl,
    }),
  });

globalThis.motionGridMastra = mastra;
