import assert from "node:assert/strict";
import test from "node:test";
import {
  consentPolicy,
  evaluatePolicies,
  externalSpendCommit,
  operatingBudgetCap,
  rateLimit,
  requireApproval,
  suppressionCheck,
} from "./evaluate";
import type {
  ApprovalRequest,
  ConsentRequest,
  ExternalSpendRequest,
  RateLimitRequest,
  SuppressionRequest,
} from "./types";

const consentBasisByMotion: ConsentRequest["basisByMotion"] = {
  creator: "explicit_opt_in",
  "business.local": "legitimate_interest",
  "business.online": "legitimate_interest",
  "consumer.ads": "legitimate_interest",
  "consumer.email": "explicit_opt_in",
};

test("operating budget decisions cover 79%, 80%, 99%, 100%, and 101%", () => {
  const decisions = [79, 80, 99, 100, 101].map((spentCents) =>
    operatingBudgetCap({
      kind: "operating_budget_cap",
      budgetCents: 100,
      spentCents,
      proposedCents: 0,
    }),
  );
  assert.deepEqual(
    decisions.map((result) => result.decision),
    ["allow", "allow", "allow", "deny", "deny"],
  );
  const warning = decisions[1];
  const pause = decisions[3];
  assert.notEqual(warning, undefined);
  assert.notEqual(pause, undefined);
  if (warning !== undefined && pause !== undefined) {
    assert.match(warning.reason, /80%/);
    assert.match(pause.reason, /pause/);
  }
});

test("external spend enforces per-deal, total, and role limits", () => {
  const base: ExternalSpendRequest = {
    kind: "external_spend_commit",
    amountPaise: 2_000_000,
    committedPaise: 1_000_000,
    maxPerDealPaise: 3_000_000,
    maxTotalPaise: 5_000_000,
    requiresRole: "budget_owner",
    actorRoles: ["budget_owner"],
  };
  assert.equal(externalSpendCommit(base).decision, "allow");
  assert.deepEqual(externalSpendCommit({ ...base, amountPaise: 3_000_001 }), {
    decision: "deny",
    reason:
      "Creator rate of ₹30,000.01 exceeds the maximum per deal of ₹30,000.",
  });
  assert.equal(
    externalSpendCommit({ ...base, committedPaise: 4_000_000 }).decision,
    "deny",
  );
  assert.equal(
    externalSpendCommit({ ...base, actorRoles: ["creator"] }).decision,
    "deny",
  );
});

test("send and roster actions require approval until approved", () => {
  const actions: readonly ApprovalRequest["action"][] = ["send", "roster"];
  for (const action of actions) {
    assert.equal(
      requireApproval({ kind: "require_approval", action, approved: false })
        .decision,
      "require_approval",
    );
    assert.equal(
      requireApproval({ kind: "require_approval", action, approved: true })
        .decision,
      "allow",
    );
  }
});

test("consent policy allows sufficient consent and denies missing opt-in", () => {
  assert.equal(
    consentPolicy({
      kind: "consent_policy",
      motionId: "business.local",
      consentBasis: "legitimate_interest",
      basisByMotion: consentBasisByMotion,
    }).decision,
    "allow",
  );
  assert.equal(
    consentPolicy({
      kind: "consent_policy",
      motionId: "creator",
      consentBasis: "explicit_opt_in",
      basisByMotion: consentBasisByMotion,
    }).decision,
    "allow",
  );
  assert.equal(
    consentPolicy({
      kind: "consent_policy",
      motionId: "creator",
      consentBasis: "legitimate_interest",
      basisByMotion: consentBasisByMotion,
    }).decision,
    "deny",
  );
});

test("suppression checks workspace and campaign scope", () => {
  const base: Omit<SuppressionRequest, "suppressions"> = {
    kind: "suppression_check",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    channel: "email",
    address: "Person@Example.com",
  };
  assert.equal(
    suppressionCheck({ ...base, suppressions: [] }).decision,
    "allow",
  );
  assert.equal(
    suppressionCheck({
      ...base,
      suppressions: [
        {
          workspaceId: "workspace-1",
          campaignId: null,
          scope: "workspace",
          channel: "email",
          address: "person@example.com",
        },
      ],
    }).decision,
    "deny",
  );
  assert.equal(
    suppressionCheck({
      ...base,
      suppressions: [
        {
          workspaceId: "workspace-1",
          campaignId: "campaign-1",
          scope: "campaign",
          channel: "email",
          address: "person@example.com",
        },
      ],
    }).decision,
    "deny",
  );
});

test("rate limit is scoped by the supplied channel and run counters", () => {
  const base: Omit<RateLimitRequest, "sentCount"> = {
    kind: "rate_limit",
    channel: "whatsapp",
    runId: "run-1",
    limit: 10,
  };
  assert.equal(rateLimit({ ...base, sentCount: 9 }).decision, "allow");
  assert.equal(rateLimit({ ...base, sentCount: 10 }).decision, "deny");
});

test("combined gate prioritizes denial, then approval", () => {
  const approval: ApprovalRequest = {
    kind: "require_approval",
    action: "send",
    approved: false,
  };
  const denial: RateLimitRequest = {
    kind: "rate_limit",
    channel: "email",
    runId: "run-1",
    sentCount: 1,
    limit: 1,
  };
  assert.equal(evaluatePolicies([approval]).decision, "require_approval");
  assert.equal(evaluatePolicies([approval, denial]).decision, "deny");
  assert.equal(evaluatePolicies([]).decision, "allow");
});
