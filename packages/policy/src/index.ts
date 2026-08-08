export type ActionRisk = "read" | "paid-read" | "external-write" | "destructive-write";

export interface ActionRequest {
  workspaceId: string;
  campaignId: string;
  capability: string;
  risk: ActionRisk;
  estimatedCostUsd: number;
  approvalId?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
}

export function evaluateAction(request: ActionRequest): PolicyDecision {
  const requiresApproval =
    request.risk === "external-write" ||
    request.risk === "destructive-write" ||
    request.estimatedCostUsd >= 25;

  return {
    allowed: !requiresApproval || Boolean(request.approvalId),
    requiresApproval,
    reasons: requiresApproval && !request.approvalId ? ["A persisted approval is required."] : [],
  };
}
