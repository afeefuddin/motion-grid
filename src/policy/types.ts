import type { z } from "zod";
import type { ChannelSchema, MotionIdSchema } from "../contracts/enums";

export type Channel = z.output<typeof ChannelSchema>;
export type MotionId = z.output<typeof MotionIdSchema>;
export type ConsentBasis = "legitimate_interest" | "explicit_opt_in";

export interface PolicyDecision {
  readonly decision: "allow" | "deny" | "require_approval";
  readonly reason: string;
  readonly warning?: {
    readonly kind: "budget_threshold";
    readonly utilizationBasisPoints: number;
  };
}

export interface OperatingBudgetRequest {
  readonly kind: "operating_budget_cap";
  readonly budgetCents: number;
  readonly spentCents: number;
  readonly proposedCents: number;
}

export interface ExternalSpendRequest {
  readonly kind: "external_spend_commit";
  readonly amountPaise: number;
  readonly committedPaise: number;
  readonly maxPerDealPaise: number;
  readonly maxTotalPaise: number;
  readonly requiresRole: string;
  readonly actorRoles: readonly string[];
}

export interface ApprovalRequest {
  readonly kind: "require_approval";
  readonly action: "send" | "roster";
  readonly approved: boolean;
}

export interface ConsentRequest {
  readonly kind: "consent_policy";
  readonly motionId: MotionId;
  readonly consentBasis: ConsentBasis;
  readonly basisByMotion: Readonly<Record<MotionId, ConsentBasis>>;
}

export interface SuppressionEntry {
  readonly workspaceId: string;
  readonly campaignId: string | null;
  readonly scope: "workspace" | "campaign";
  readonly channel: Channel;
  readonly address: string;
}

export interface SuppressionRequest {
  readonly kind: "suppression_check";
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly channel: Channel;
  readonly address: string;
  readonly suppressions: readonly SuppressionEntry[];
}

export interface RateLimitRequest {
  readonly kind: "rate_limit";
  readonly channel: Channel;
  readonly runId: string;
  readonly sentCount: number;
  readonly limit: number;
}

export type PolicyRequest =
  | OperatingBudgetRequest
  | ExternalSpendRequest
  | ApprovalRequest
  | ConsentRequest
  | SuppressionRequest
  | RateLimitRequest;
