import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  CampaignSpecSchema,
  CompileObjectiveInputSchema,
  PlanDataSchema,
  SynthesizeDataSchema,
  TargetSchema,
} from "../../contracts";
import {
  type BusinessLocalRuntime,
  discoverBusinessLocal,
  processBusinessLocalTarget,
} from "./business-local";

const CampaignWorkflowInputSchema = CompileObjectiveInputSchema.extend({
  runId: z.uuid(),
  planId: z.uuid(),
  workspaceName: z.string().min(1),
});

const CampaignContextSchema = CampaignWorkflowInputSchema.extend({
  spec: CampaignSpecSchema,
  plan: PlanDataSchema.optional(),
});

const PlannedCampaignSchema = CampaignWorkflowInputSchema.extend({
  spec: CampaignSpecSchema,
  plan: PlanDataSchema,
});

const TargetJobSchema = PlannedCampaignSchema.extend({ target: TargetSchema });
const TargetResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    targetId: z.uuid(),
    isFit: z.boolean(),
    droppedCount: z.int().nonnegative(),
    plan: PlanDataSchema,
  }),
  z.object({ ok: z.literal(false), targetId: z.string(), reason: z.string() }),
]);
const MotionResultSchema = z.object({
  ok: z.boolean(),
  targetIds: z.array(z.uuid()),
  failures: z.array(z.string()),
});

type CampaignWorkflowInput = z.output<typeof CampaignWorkflowInputSchema>;
type PlannedCampaign = z.output<typeof PlannedCampaignSchema>;

export interface CampaignWorkflowServices {
  compileObjective(
    input: z.output<typeof CompileObjectiveInputSchema>,
  ): Promise<z.output<typeof CampaignSpecSchema>>;
  planCampaign(input: {
    readonly campaignId: string;
    readonly planId: string;
    readonly spec: z.output<typeof CampaignSpecSchema>;
  }): Promise<z.output<typeof PlanDataSchema>>;
  businessRuntime(input: PlannedCampaign): BusinessLocalRuntime;
  runCreator(input: PlannedCampaign): Promise<{
    readonly ok: boolean;
    readonly targetIds: readonly string[];
    readonly failures: readonly string[];
  }>;
  recordPlanDecision(input: {
    readonly campaignId: string;
    readonly runId: string;
    readonly planId: string;
    readonly approved: boolean;
    readonly reviewerId: string;
  }): Promise<void>;
  synthesize(input: {
    readonly campaignId: string;
    readonly runId: string;
    readonly targetIds: readonly string[];
  }): Promise<z.output<typeof SynthesizeDataSchema>>;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown motion failure.";
}

/** Creates the independently resumable target workflow used by business.local foreach. */
export function createTargetWorkflow(
  runtimeFor: (input: PlannedCampaign) => BusinessLocalRuntime,
) {
  const targetStep = createStep({
    id: "target-pipeline",
    inputSchema: TargetJobSchema,
    outputSchema: TargetResultSchema,
    execute: ({ inputData }) =>
      processBusinessLocalTarget(
        inputData,
        runtimeFor(PlannedCampaignSchema.parse(inputData)),
      ),
  });

  return createWorkflow({
    id: "target-workflow",
    inputSchema: TargetJobSchema,
    outputSchema: TargetResultSchema,
  })
    .then(targetStep)
    .commit();
}

/** Creates business.local with one discovery followed by nested per-target workflows. */
export function createBusinessLocalWorkflow(
  runtimeFor: (input: PlannedCampaign) => BusinessLocalRuntime,
) {
  const discoverStep = createStep({
    id: "discover-step",
    inputSchema: PlannedCampaignSchema,
    outputSchema: z.array(TargetJobSchema),
    execute: async ({ inputData }) => {
      const result = await discoverBusinessLocal(
        inputData,
        runtimeFor(inputData),
      );
      if (!result.ok) {
        return [];
      }
      return result.targets.map((target) => ({
        ...inputData,
        plan: result.plan,
        target,
      }));
    },
  });

  return createWorkflow({
    id: "business-local-workflow",
    inputSchema: PlannedCampaignSchema,
    outputSchema: z.array(TargetResultSchema),
  })
    .then(discoverStep)
    .foreach(createTargetWorkflow(runtimeFor), { concurrency: 8 })
    .commit();
}

/**
 * Composes objective compilation, T5 planning, durable approval, isolated motion
 * fan-out, and T8 synthesis into the campaign execution spine.
 */
export function createCampaignWorkflow(services: CampaignWorkflowServices) {
  const compileObjectiveStep = createStep({
    id: "compile-objective-step",
    inputSchema: CampaignWorkflowInputSchema,
    outputSchema: CampaignContextSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      spec: await services.compileObjective(inputData),
    }),
  });
  const planStep = createStep({
    id: "plan-step",
    inputSchema: CampaignContextSchema,
    outputSchema: PlannedCampaignSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      plan: await services.planCampaign({
        campaignId: inputData.campaignId,
        planId: inputData.planId,
        spec: inputData.spec,
      }),
    }),
  });
  const approvalGate = createStep({
    id: "approval-gate",
    inputSchema: PlannedCampaignSchema,
    outputSchema: PlannedCampaignSchema,
    resumeSchema: z.object({ approved: z.boolean(), reviewerId: z.uuid() }),
    suspendSchema: z.object({
      reason: z.string(),
      plan: PlanDataSchema,
    }),
    execute: async ({ inputData, resumeData, suspend, bail }) => {
      if (resumeData?.approved === false) {
        await services.recordPlanDecision({
          campaignId: inputData.campaignId,
          runId: inputData.runId,
          planId: inputData.planId,
          approved: false,
          reviewerId: resumeData.reviewerId,
        });
        return bail({ reason: "The campaign plan was rejected." });
      }
      if (resumeData?.approved !== true) {
        return suspend({
          reason: "Approve the ranked bindings and declined motions.",
          plan: inputData.plan,
        });
      }
      await services.recordPlanDecision({
        campaignId: inputData.campaignId,
        runId: inputData.runId,
        planId: inputData.planId,
        approved: true,
        reviewerId: resumeData.reviewerId,
      });
      return inputData;
    },
  });
  const creatorStep = createStep({
    id: "creator-workflow",
    inputSchema: PlannedCampaignSchema,
    outputSchema: MotionResultSchema,
    execute: async ({ inputData }) => {
      try {
        const result = await services.runCreator(inputData);
        return {
          ok: result.ok,
          targetIds: [...result.targetIds],
          failures: [...result.failures],
        };
      } catch (error) {
        return { ok: false, targetIds: [], failures: [reason(error)] };
      }
    },
  });
  const businessLocalWorkflow = createBusinessLocalWorkflow(
    services.businessRuntime,
  );
  const synthesizeStep = createStep({
    id: "synthesize-step",
    inputSchema: z.object({
      "business-local-workflow": z.array(TargetResultSchema),
      "creator-workflow": MotionResultSchema,
    }),
    outputSchema: SynthesizeDataSchema,
    execute: async ({ inputData, getInitData }) => {
      const initial = CampaignWorkflowInputSchema.parse(getInitData());
      const localIds = inputData["business-local-workflow"].flatMap((target) =>
        target.ok ? [target.targetId] : [],
      );
      return services.synthesize({
        campaignId: initial.campaignId,
        runId: initial.runId,
        targetIds: [...localIds, ...inputData["creator-workflow"].targetIds],
      });
    },
  });

  return createWorkflow({
    id: "campaign-workflow",
    inputSchema: CampaignWorkflowInputSchema,
    outputSchema: SynthesizeDataSchema,
  })
    .then(compileObjectiveStep)
    .then(planStep)
    .then(approvalGate)
    .parallel([businessLocalWorkflow, creatorStep])
    .then(synthesizeStep)
    .commit();
}

export type { CampaignWorkflowInput };
