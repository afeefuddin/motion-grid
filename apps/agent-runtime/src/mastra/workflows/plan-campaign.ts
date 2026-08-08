import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  campaignObjectiveSchema,
  campaignPlanSchema,
  type CampaignPlan,
} from "@motiongrid/domain";

const constructPlan = createStep({
  id: "construct-campaign-plan",
  description: "Turn an objective into a structured, reviewable campaign plan.",
  inputSchema: campaignObjectiveSchema,
  outputSchema: campaignPlanSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("businessAgent");

    const response = await agent.generate(
      `Analyze this campaign objective and briefly explain the likely operating mode, target and constraints. Do not claim to have executed anything.\n\n${inputData.objective}`,
    );

    const plan: CampaignPlan = {
      campaignId: inputData.campaignId,
      motion: "business",
      mode: "local-discovery",
      rationale: response.text,
      assumptions: [
        "The objective targets physical businesses in a bounded geography.",
        "External outreach remains disabled until a human approves the final target set.",
      ],
      expectedTargets: 120,
      estimatedCostUsd: 18.4,
      steps: [
        { id: "discover", title: "Discover businesses", capability: "search_local_businesses", behavior: "read", approvalRequired: false },
        { id: "analyze", title: "Analyze sites and reviews", capability: "analyze_business_evidence", behavior: "read", approvalRequired: false },
        { id: "score", title: "Score opportunities", capability: "score_b2b_opportunity", behavior: "read", approvalRequired: false },
        { id: "contacts", title: "Find decision-makers", capability: "find_decision_makers", behavior: "read", approvalRequired: false },
        { id: "outreach", title: "Launch approved outreach", capability: "send_sales_outreach", behavior: "write", approvalRequired: true },
      ],
      risks: ["Provider cost may change after the target geography is resolved."],
      successMetrics: ["Qualified opportunities", "Approved outreach rate", "Booked demos"],
    };

    return plan;
  },
});

export const planCampaignWorkflow = createWorkflow({
  id: "plan-campaign",
  inputSchema: campaignObjectiveSchema,
  outputSchema: campaignPlanSchema,
})
  .then(constructPlan)
  .commit();
