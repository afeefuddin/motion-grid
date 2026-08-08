import type {
  ApprovalRequest,
  ConsentRequest,
  ExternalSpendRequest,
  OperatingBudgetRequest,
  PolicyDecision,
  PolicyRequest,
  RateLimitRequest,
  SuppressionRequest,
} from "./types";

export function operatingBudgetCap(
  request: OperatingBudgetRequest,
): PolicyDecision {
  const afterCents = request.spentCents + request.proposedCents;
  if (request.budgetCents === 0 || afterCents >= request.budgetCents) {
    return {
      decision: "deny",
      reason:
        "Operating budget is fully used; the campaign must pause before this cost is incurred.",
    };
  }
  if (afterCents * 100 >= request.budgetCents * 80) {
    return {
      decision: "allow",
      reason:
        "Operating budget has reached at least 80%; continue with a budget warning.",
      warning: {
        kind: "budget_threshold",
        utilizationBasisPoints: Math.floor(
          (afterCents * 10_000) / request.budgetCents,
        ),
      },
    };
  }
  return { decision: "allow", reason: "Operating cost is within budget." };
}

export function externalSpendCommit(
  request: ExternalSpendRequest,
): PolicyDecision {
  if (request.amountPaise > request.maxPerDealPaise) {
    return {
      decision: "deny",
      reason: `Creator rate of ₹${(request.amountPaise / 100).toLocaleString("en-IN")} exceeds the maximum per deal of ₹${(request.maxPerDealPaise / 100).toLocaleString("en-IN")}.`,
    };
  }
  if (request.committedPaise + request.amountPaise > request.maxTotalPaise) {
    return {
      decision: "deny",
      reason:
        "This commitment would exceed the campaign's total external-spend limit.",
    };
  }
  if (!request.actorRoles.includes(request.requiresRole)) {
    return {
      decision: "deny",
      reason: `Only a user with the ${request.requiresRole} role may commit this spend.`,
    };
  }
  return {
    decision: "allow",
    reason: "External spend is within the approved limits.",
  };
}

export function requireApproval(request: ApprovalRequest): PolicyDecision {
  if (request.approved) {
    return {
      decision: "allow",
      reason:
        request.action === "send"
          ? "Outbound message was approved."
          : "Creator roster was approved.",
    };
  }
  return {
    decision: "require_approval",
    reason:
      request.action === "send"
        ? "Every outbound message requires human approval before sending."
        : "Creator allocation requires human approval before committing the roster.",
  };
}

export function consentPolicy(request: ConsentRequest): PolicyDecision {
  const required = request.basisByMotion[request.motionId];
  if (
    required === "explicit_opt_in" &&
    request.consentBasis !== "explicit_opt_in"
  ) {
    return {
      decision: "deny",
      reason: `The ${request.motionId} motion requires explicit opt-in for this contact.`,
    };
  }
  return {
    decision: "allow",
    reason: `The contact satisfies the ${required.replace("_", " ")} consent policy.`,
  };
}

export function suppressionCheck(request: SuppressionRequest): PolicyDecision {
  const address = request.address.trim().toLocaleLowerCase();
  const match = request.suppressions.find(
    (entry) =>
      entry.workspaceId === request.workspaceId &&
      entry.channel === request.channel &&
      entry.address.trim().toLocaleLowerCase() === address &&
      (entry.scope === "workspace" || entry.campaignId === request.campaignId),
  );
  if (match !== undefined) {
    return {
      decision: "deny",
      reason: `This ${request.channel} address is suppressed at ${match.scope} scope and cannot be contacted.`,
    };
  }
  return {
    decision: "allow",
    reason: "No matching campaign or workspace suppression exists.",
  };
}

export function rateLimit(request: RateLimitRequest): PolicyDecision {
  if (request.sentCount >= request.limit) {
    return {
      decision: "deny",
      reason: `The ${request.channel} limit for this run has been reached.`,
    };
  }
  return {
    decision: "allow",
    reason: `The ${request.channel} send is within this run's rate limit.`,
  };
}

/** Evaluates one policy without model input or external I/O. */
export function evaluatePolicy(request: PolicyRequest): PolicyDecision {
  switch (request.kind) {
    case "operating_budget_cap":
      return operatingBudgetCap(request);
    case "external_spend_commit":
      return externalSpendCommit(request);
    case "require_approval":
      return requireApproval(request);
    case "consent_policy":
      return consentPolicy(request);
    case "suppression_check":
      return suppressionCheck(request);
    case "rate_limit":
      return rateLimit(request);
  }
}

/** Denials take precedence over approvals; input order breaks ties deterministically. */
export function evaluatePolicies(
  requests: readonly PolicyRequest[],
): PolicyDecision {
  const decisions = requests.map(evaluatePolicy);
  const denial = decisions.find((result) => result.decision === "deny");
  if (denial !== undefined) {
    return denial;
  }
  const approval = decisions.find(
    (result) => result.decision === "require_approval",
  );
  if (approval !== undefined) {
    return approval;
  }
  return {
    decision: "allow",
    reason: "All enabled policies allow this action.",
  };
}
