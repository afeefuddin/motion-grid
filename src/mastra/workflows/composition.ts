import { randomUUID } from "node:crypto";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  CampaignSpecSchema,
  CompileObjectiveInputSchema,
  PlanDataSchema,
  SynthesizeDataSchema,
  TargetSchema,
  WorkspaceSourceSchema,
} from "../../contracts";
import { organizationMotionIds } from "../../motions";
import type { OrganizationMotionId } from "../../motions/types";
import {
  discoverOrganization,
  type OrganizationRuntime,
  processOrganizationTarget,
} from "./organization";
import type { WorkflowEventSink } from "./replan";

const CampaignWorkflowInputSchema = CompileObjectiveInputSchema.extend({
  runId: z.uuid(),
  planId: z.uuid(),
  workspaceName: z.string().min(1),
  connectedSources: z.array(WorkspaceSourceSchema),
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
    readonly runId: string;
    readonly planId: string;
    readonly spec: z.output<typeof CampaignSpecSchema>;
    readonly connectedSources: z.output<typeof WorkspaceSourceSchema>[];
  }): Promise<z.output<typeof PlanDataSchema>>;
  recordCompiledSpec(input: {
    readonly campaignId: string;
    readonly name: string;
    readonly budget: z.output<typeof CampaignSpecSchema>["budget"];
    readonly spec: z.output<typeof CampaignSpecSchema>;
  }): Promise<void>;
  businessRuntime(
    input: PlannedCampaign,
    events?: WorkflowEventSink,
  ): OrganizationRuntime;
  runCreator(input: PlannedCampaign): Promise<{
    readonly ok: boolean;
    readonly targetIds: readonly string[];
    readonly failures: readonly string[];
  }>;
  synthesize(input: {
    readonly campaignId: string;
    readonly runId: string;
    readonly targetIds: readonly string[];
  }): Promise<z.output<typeof SynthesizeDataSchema>>;
  recordFailure?(input: {
    readonly campaignId: string;
    readonly runId: string;
    readonly reason: string;
  }): Promise<void>;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown motion failure.";
}

function agentStatus(
  input: { campaignId: string; runId: string },
  agentId: string,
  label: string,
  status: "running" | "completed" | "failed",
  detail: string,
) {
  return {
    id: randomUUID(),
    runId: input.runId,
    campaignId: input.campaignId,
    occurredAt: new Date().toISOString(),
    type: "agent.status",
    data: { agentId, label, status, detail },
  };
}

function streamWorkflowEvents(
  input: PlannedCampaign,
  write: (value: unknown) => Promise<void>,
): WorkflowEventSink {
  return {
    async emit(event) {
      if (event.type === "assessment.recorded") {
        await write({
          id: randomUUID(),
          runId: event.runId,
          campaignId: event.campaignId,
          occurredAt: new Date().toISOString(),
          type: event.type,
          data: {
            targetId: event.targetId,
            score: event.score,
            isFit: event.isFit,
            reason: event.reason,
            droppedCount: event.droppedCount,
          },
        });
        return;
      }
      if (event.type === "approval.required") {
        await write({
          id: randomUUID(),
          runId: event.runId,
          campaignId: event.campaignId,
          occurredAt: new Date().toISOString(),
          type: event.type,
          data: { approval: event.approval },
        });
        return;
      }
      if (event.type !== "replan_started") {
        return;
      }
      await write({
        id: randomUUID(),
        runId: input.runId,
        campaignId: input.campaignId,
        occurredAt: new Date().toISOString(),
        type: "replan_started",
        data: {
          planId: input.planId,
          trigger: event.trigger,
          reason: event.reason,
        },
      });
    },
  };
}

/** Creates the independently resumable target workflow used by organization foreach. */
export function createTargetWorkflow(
  motionId: OrganizationMotionId,
  runtimeFor: (
    input: PlannedCampaign,
    events?: WorkflowEventSink,
  ) => OrganizationRuntime,
) {
  const targetStep = createStep({
    id: "target-pipeline",
    inputSchema: TargetJobSchema,
    outputSchema: TargetResultSchema,
    execute: async ({ inputData, writer }) => {
      const planned = PlannedCampaignSchema.parse(inputData);
      await writer.write(
        agentStatus(
          planned,
          "target-pipeline",
          "Evidence team",
          "running",
          `Checking evidence and fit for ${inputData.target.name}.`,
        ),
      );
      try {
        const result = await processOrganizationTarget(
          motionId,
          inputData,
          runtimeFor(
            planned,
            streamWorkflowEvents(planned, (value) => writer.write(value)),
          ),
        );
        await writer.write(
          agentStatus(
            planned,
            "target-pipeline",
            "Evidence team",
            "completed",
            `Finished the evidence pass for ${inputData.target.name}.`,
          ),
        );
        return result;
      } catch (error) {
        await writer.write(
          agentStatus(
            planned,
            "target-pipeline",
            "Evidence team",
            "failed",
            `Could not finish ${inputData.target.name}: ${reason(error)}`,
          ),
        );
        throw error;
      }
    },
  });

  return createWorkflow({
    id: `${motionId}-target-workflow`,
    inputSchema: TargetJobSchema,
    outputSchema: TargetResultSchema,
  })
    .then(targetStep)
    .commit();
}

/** Creates an organization motion with discovery and isolated target pipelines. */
export function createOrganizationWorkflow<const WorkflowId extends string>(
  motionId: OrganizationMotionId,
  workflowId: WorkflowId,
  runtimeFor: (
    input: PlannedCampaign,
    events?: WorkflowEventSink,
  ) => OrganizationRuntime,
) {
  const discoverStep = createStep({
    id: "discover-step",
    inputSchema: PlannedCampaignSchema,
    outputSchema: z.array(TargetJobSchema),
    execute: async ({ inputData, writer }) => {
      if (
        !inputData.plan.motions.some((motion) => motion.motionId === motionId)
      ) {
        return [];
      }
      const result = await discoverOrganization(
        motionId,
        inputData,
        runtimeFor(
          inputData,
          streamWorkflowEvents(inputData, (value) => writer.write(value)),
        ),
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
    id: workflowId,
    inputSchema: PlannedCampaignSchema,
    outputSchema: z.array(TargetResultSchema),
  })
    .then(discoverStep)
    .foreach(createTargetWorkflow(motionId, runtimeFor), { concurrency: 8 })
    .commit();
}

/**
 * Composes objective compilation, planning, selected-motion fan-out, and synthesis.
 */
export function createCampaignWorkflow(services: CampaignWorkflowServices) {
  const compileObjectiveStep = createStep({
    id: "compile-objective-step",
    inputSchema: CampaignWorkflowInputSchema,
    outputSchema: CampaignContextSchema,
    execute: async ({ inputData, writer }) => {
      await writer.write(
        agentStatus(
          inputData,
          "objective-compiler",
          "Objective compiler",
          "running",
          "Translating the latest brief into campaign constraints.",
        ),
      );
      try {
        const spec = await services.compileObjective(inputData);
        await services.recordCompiledSpec({
          campaignId: inputData.campaignId,
          name: spec.name,
          budget: spec.budget,
          spec,
        });
        await writer.write(
          agentStatus(
            inputData,
            "objective-compiler",
            "Objective compiler",
            "completed",
            "The revised objective and constraints are ready.",
          ),
        );
        return { ...inputData, spec };
      } catch (error) {
        await services.recordFailure?.({
          campaignId: inputData.campaignId,
          runId: inputData.runId,
          reason: reason(error),
        });
        await writer.write(
          agentStatus(
            inputData,
            "objective-compiler",
            "Objective compiler",
            "failed",
            reason(error),
          ),
        );
        throw error;
      }
    },
  });
  const planStep = createStep({
    id: "plan-step",
    inputSchema: CampaignContextSchema,
    outputSchema: PlannedCampaignSchema,
    execute: async ({ inputData, writer }) => {
      await writer.write(
        agentStatus(
          inputData,
          "planner",
          "Campaign planner",
          "running",
          "Re-ranking motions, providers, policy gates, and budget allocation.",
        ),
      );
      let plan: z.output<typeof PlanDataSchema>;
      try {
        plan = await services.planCampaign({
          campaignId: inputData.campaignId,
          runId: inputData.runId,
          planId: inputData.planId,
          spec: inputData.spec,
          connectedSources: inputData.connectedSources,
        });
        await writer.write(
          agentStatus(
            inputData,
            "planner",
            "Campaign planner",
            "completed",
            "A revised route is ready for review.",
          ),
        );
      } catch (error) {
        await services.recordFailure?.({
          campaignId: inputData.campaignId,
          runId: inputData.runId,
          reason: reason(error),
        });
        await writer.write(
          agentStatus(
            inputData,
            "planner",
            "Campaign planner",
            "failed",
            reason(error),
          ),
        );
        throw error;
      }
      const envelope = () => ({
        id: randomUUID(),
        runId: inputData.runId,
        campaignId: inputData.campaignId,
        occurredAt: new Date().toISOString(),
      });
      await writer.write({
        ...envelope(),
        type: "plan.delta",
        data: {
          sequence: 1,
          delta: "Published the revised campaign route.",
          snapshot: plan,
        },
      });
      for (const declined of plan.declinedMotions) {
        await writer.write({
          ...envelope(),
          type: "motion_declined",
          data: declined,
        });
      }
      for (const motion of plan.motions) {
        await writer.write({
          ...envelope(),
          type: "motion_selected",
          data: { motionId: motion.motionId, rationale: motion.rationale },
        });
        for (const binding of motion.bindings) {
          await writer.write({
            ...envelope(),
            type: "capability_ranked",
            data: {
              capabilityId: binding.capabilityId,
              weights: binding.weights,
              weightsRationale: binding.weightsRationale,
              candidates: binding.candidates,
            },
          });
          await writer.write({
            ...envelope(),
            type: "binding_chosen",
            data: {
              capabilityId: binding.capabilityId,
              chosen: binding.chosen,
            },
          });
        }
      }
      return { ...inputData, plan };
    },
  });
  const creatorStep = createStep({
    id: "creator-workflow",
    inputSchema: PlannedCampaignSchema,
    outputSchema: MotionResultSchema,
    execute: async ({ inputData, writer }) => {
      if (
        !inputData.plan.motions.some((motion) => motion.motionId === "creator")
      ) {
        return { ok: true, targetIds: [], failures: [] };
      }
      await writer.write(
        agentStatus(
          inputData,
          "creator-motion",
          "Creator motion",
          "running",
          "Evaluating creator-assisted paths for the selected route.",
        ),
      );
      try {
        const result = await services.runCreator(inputData);
        await writer.write(
          agentStatus(
            inputData,
            "creator-motion",
            "Creator motion",
            "completed",
            "Creator candidates and relationship paths are updated.",
          ),
        );
        return {
          ok: result.ok,
          targetIds: [...result.targetIds],
          failures: [...result.failures],
        };
      } catch (error) {
        await writer.write(
          agentStatus(
            inputData,
            "creator-motion",
            "Creator motion",
            "failed",
            reason(error),
          ),
        );
        return { ok: false, targetIds: [], failures: [reason(error)] };
      }
    },
  });
  const businessLocalWorkflow = createOrganizationWorkflow(
    organizationMotionIds[0],
    "business-local-workflow",
    services.businessRuntime,
  );
  const businessOnlineWorkflow = createOrganizationWorkflow(
    organizationMotionIds[1],
    "business-online-workflow",
    services.businessRuntime,
  );
  const synthesizeStep = createStep({
    id: "synthesize-step",
    inputSchema: z.object({
      "business-local-workflow": z.array(TargetResultSchema),
      "business-online-workflow": z.array(TargetResultSchema),
      "creator-workflow": MotionResultSchema,
    }),
    outputSchema: SynthesizeDataSchema,
    execute: async ({ inputData, getInitData, writer }) => {
      const initial = CampaignWorkflowInputSchema.parse(getInitData());
      await writer.write(
        agentStatus(
          initial,
          "synthesizer",
          "Campaign synthesizer",
          "running",
          "Combining target, evidence, cost, and relationship results.",
        ),
      );
      const localIds = inputData["business-local-workflow"].flatMap((target) =>
        target.ok ? [target.targetId] : [],
      );
      const onlineIds = inputData["business-online-workflow"].flatMap(
        (target) => (target.ok ? [target.targetId] : []),
      );
      let result: z.output<typeof SynthesizeDataSchema>;
      try {
        result = await services.synthesize({
          campaignId: initial.campaignId,
          runId: initial.runId,
          targetIds: [
            ...localIds,
            ...onlineIds,
            ...inputData["creator-workflow"].targetIds,
          ],
        });
      } catch (error) {
        await services.recordFailure?.({
          campaignId: initial.campaignId,
          runId: initial.runId,
          reason: reason(error),
        });
        await writer.write(
          agentStatus(
            initial,
            "synthesizer",
            "Campaign synthesizer",
            "failed",
            reason(error),
          ),
        );
        throw error;
      }
      await writer.write(
        agentStatus(
          initial,
          "synthesizer",
          "Campaign synthesizer",
          "completed",
          "The campaign artifact now reflects the completed run.",
        ),
      );
      return result;
    },
  });

  return createWorkflow({
    id: "campaign-workflow",
    inputSchema: CampaignWorkflowInputSchema,
    outputSchema: SynthesizeDataSchema,
  })
    .then(compileObjectiveStep)
    .then(planStep)
    .parallel([businessLocalWorkflow, businessOnlineWorkflow, creatorStep])
    .then(synthesizeStep)
    .commit();
}

export type { CampaignWorkflowInput };
