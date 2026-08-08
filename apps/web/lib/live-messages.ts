import { and, count, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  ApprovalSchema,
  MessageSchema,
  NewToolCallSchema,
} from "../../../src/contracts";
import type { ApproveMessageRequestSchema } from "../../../src/contracts/api";
import type { CapabilityId } from "../../../src/contracts/capabilities";
import {
  ResendEmailAdapter,
  ResendEmailError,
  WhatsAppWebAdapter,
  WhatsAppWebError,
} from "../../../src/adapters/live";
import type { Adapter } from "../../../src/capabilities/adapter";
import {
  executeCapability,
  type ToolCallEntry,
  type ToolCallWriter,
} from "../../../src/capabilities/execute";
import { getCapability } from "../../../src/capabilities/registry";
import {
  approval,
  campaign,
  contact,
  message,
  suppression,
  toolCall,
} from "../../../src/db/schema";
import { evaluatePolicies } from "../../../src/policy";
import { publishSseEvent } from "./sse";

async function database() {
  const module = await import("../../../src/db/client");
  return module.db;
}

export class MessageDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MessageDeliveryError";
  }
}

function commaSeparatedAllowlist(name: string) {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function requireAllowedRecipient(channel: "email" | "whatsapp", address: string) {
  const environmentName =
    channel === "email"
      ? "RESEND_ALLOWED_RECIPIENTS"
      : "WHATSAPP_ALLOWED_RECIPIENTS";
  const recipients = commaSeparatedAllowlist(environmentName);
  if (recipients.size === 0) {
    throw new MessageDeliveryError(
      "allowlist_not_configured",
      `${environmentName} is not configured.`,
      503,
    );
  }
  if (!recipients.has(address.trim().toLowerCase())) {
    throw new MessageDeliveryError(
      "recipient_not_allowed",
      `This recipient is not in ${environmentName}.`,
      403,
    );
  }
}

function liveAdapter(channel: "email" | "whatsapp") {
  if (channel === "whatsapp") {
    return new WhatsAppWebAdapter({
      baseUrl: process.env.WHATSAPP_SERVICE_URL ?? "",
      apiKey: process.env.WHATSAPP_SERVICE_API_KEY ?? "",
      from: process.env.WHATSAPP_FROM ?? "",
    });
  }
  return new ResendEmailAdapter({
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.RESEND_FROM_EMAIL ?? "",
  });
}

class DatabaseToolCallWriter implements ToolCallWriter {
  async record<C extends CapabilityId>(entry: ToolCallEntry<C>) {
    const db = await database();
    await db.insert(toolCall).values(NewToolCallSchema.parse(entry));
  }
}

interface DeliveryDependencies {
  readonly adapter?: Adapter<"message.send">;
  readonly ledger?: ToolCallWriter;
}

/** Approves one persisted draft, applies every send policy, then invokes the capability funnel. */
export async function approveAndDeliverMessage(
  input: z.output<typeof ApproveMessageRequestSchema>,
  dependencies: DeliveryDependencies = {},
) {
  const db = await database();
  const rows = await db
    .select({
      message,
      address: contact.address,
      workspaceId: campaign.workspaceId,
      operatingBudgetCents: campaign.operatingBudgetCents,
      operatingSpentCents: campaign.operatingSpentCents,
    })
    .from(message)
    .innerJoin(contact, eq(contact.id, message.contactId))
    .innerJoin(campaign, eq(campaign.id, message.campaignId))
    .where(eq(message.id, input.messageId))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new MessageDeliveryError("message_not_found", "Message not found.", 404);
  }
  const persistedMessage = MessageSchema.parse(row.message);
  if (
    persistedMessage.status !== "draft" &&
    persistedMessage.status !== "pending_approval" &&
    persistedMessage.status !== "approved"
  ) {
    throw new MessageDeliveryError(
      "message_not_sendable",
      `A message in ${persistedMessage.status} state cannot be approved for delivery.`,
      409,
    );
  }
  const to =
    persistedMessage.channel === "whatsapp"
      ? process.env.WHATSAPP_TO ?? row.address
      : process.env.RESEND_TO_EMAIL ?? row.address;
  const adapter = dependencies.adapter ?? liveAdapter(persistedMessage.channel);
  const suppressions = await db
    .select()
    .from(suppression)
    .where(
      and(
        eq(suppression.workspaceId, row.workspaceId),
        eq(suppression.channel, persistedMessage.channel),
      ),
    );
  const sentRows = await db
    .select({ total: count() })
    .from(message)
    .where(
      and(
        eq(message.runId, persistedMessage.runId),
        eq(message.channel, persistedMessage.channel),
        eq(message.status, "sent"),
      ),
    );
  const proposedCents = Math.ceil(adapter.unitCost.operatingCents);
  const decision = evaluatePolicies([
    { kind: "require_approval", action: "send", approved: input.approved },
    {
      kind: "suppression_check",
      workspaceId: row.workspaceId,
      campaignId: persistedMessage.campaignId,
      channel: persistedMessage.channel,
      address: row.address,
      suppressions,
    },
    // A delivery override redirects the provider call; it must not bypass suppression.
    {
      kind: "suppression_check",
      workspaceId: row.workspaceId,
      campaignId: persistedMessage.campaignId,
      channel: persistedMessage.channel,
      address: to,
      suppressions,
    },
    {
      kind: "operating_budget_cap",
      budgetCents: row.operatingBudgetCents,
      spentCents: row.operatingSpentCents,
      proposedCents,
    },
    {
      kind: "rate_limit",
      channel: persistedMessage.channel,
      runId: persistedMessage.runId,
      sentCount: sentRows[0] === undefined ? 0 : sentRows[0].total,
      limit: adapter.profile.rateLimitPerMinute ?? 100,
    },
  ]);

  const decidedAt = new Date();
  const pendingApproval = await db
    .select()
    .from(approval)
    .where(
      and(
        eq(approval.messageId, persistedMessage.id),
        eq(approval.status, "pending"),
      ),
    )
    .orderBy(desc(approval.requestedAt))
    .limit(1);
  const existingPendingApproval = pendingApproval[0];
  const approvalRows =
    existingPendingApproval === undefined
      ? await db
          .insert(approval)
          .values({
            campaignId: persistedMessage.campaignId,
            runId: persistedMessage.runId,
            messageId: persistedMessage.id,
            decision: decision.decision,
            status: decision.decision === "allow" ? "approved" : "rejected",
            reason: decision.reason,
            decidedAt,
            decidedBy: input.decidedBy,
          })
          .returning()
      : await db
          .update(approval)
          .set({
            decision: decision.decision,
            status: decision.decision === "allow" ? "approved" : "rejected",
            reason: decision.reason,
            decidedAt,
            decidedBy: input.decidedBy,
            updatedAt: decidedAt,
          })
          .where(eq(approval.id, existingPendingApproval.id))
          .returning();
  const recordedApproval = ApprovalSchema.parse(approvalRows[0]);
  if (decision.decision !== "allow") {
    return { message: persistedMessage, approval: recordedApproval };
  }

  requireAllowedRecipient(persistedMessage.channel, to);
  const from =
    persistedMessage.channel === "whatsapp"
      ? process.env.WHATSAPP_FROM ?? ""
      : process.env.RESEND_FROM_EMAIL ?? "";
  const output = await executeCapability({
    context: {
      campaignId: persistedMessage.campaignId,
      runId: persistedMessage.runId,
      targetId: persistedMessage.targetId,
    },
    capability: getCapability("message.send"),
    binding: {
      capabilityId: "message.send",
      adapterId: adapter.id,
      mode: adapter.mode,
    },
    adapter,
    input: {
      messageId: persistedMessage.id,
      channel: persistedMessage.channel,
      from,
      to,
      subject: persistedMessage.subject,
      body: persistedMessage.body,
      idempotencyKey: `message-${persistedMessage.id}`,
    },
    ledger: dependencies.ledger ?? new DatabaseToolCallWriter(),
  });
  const sentAt = new Date(output.acceptedAt);
  await db
    .update(campaign)
    .set({
      operatingSpentCents: sql`${campaign.operatingSpentCents} + ${proposedCents}`,
      updatedAt: sentAt,
    })
    .where(eq(campaign.id, persistedMessage.campaignId));
  const updatedRows = await db
    .update(message)
    .set({
      status: "sent",
      providerRef: output.providerRef,
      sentAt,
      updatedAt: sentAt,
    })
    .where(eq(message.id, persistedMessage.id))
    .returning();
  const sentMessage = MessageSchema.parse(updatedRows[0]);
  publishSseEvent({
    id: crypto.randomUUID(),
    type: "message.sent",
    runId: sentMessage.runId,
    campaignId: sentMessage.campaignId,
    occurredAt: sentAt.toISOString(),
    data: { message: sentMessage },
  });
  return { message: sentMessage, approval: recordedApproval };
}

export function providerErrorResponse(error: unknown) {
  if (error instanceof MessageDeliveryError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  if (error instanceof WhatsAppWebError) {
    return {
      code: error.code,
      message: error.message,
      status: error.statusCode ?? 502,
    };
  }
  if (error instanceof ResendEmailError) {
    return {
      code: error.code,
      message: error.message,
      status: error.statusCode ?? 502,
    };
  }
  return {
    code: "delivery_failed",
    message: error instanceof Error ? error.message : "Message delivery failed.",
    status: 500,
  };
}
