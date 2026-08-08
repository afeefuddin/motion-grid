import { and, desc, eq, sql } from "drizzle-orm";
import { InteractionSchema } from "../../../src/contracts";
import type { z } from "zod";
import type {
  ResendWebhookRequestSchema,
  TwilioWebhookRequestSchema,
} from "../../../src/contracts/api";
import {
  campaign,
  contact,
  interaction,
  message,
  run,
  suppression,
  target,
  toolCall,
} from "../../../src/db/schema";
import { runReplyClassifier } from "../../../src/mastra/agents/reply-classifier";
import { publishSseEvent } from "./sse";
import type { TwilioStatusWebhookSchema } from "./twilio-webhook";

async function database() {
  const module = await import("../../../src/db/client");
  return module.db;
}

export class WebhookIngestionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WebhookIngestionError";
  }
}

/** Persists a verified Resend delivery/open event and broadcasts it to the active run. */
export async function ingestResendEvent(
  webhook: z.output<typeof ResendWebhookRequestSchema>,
) {
  const db = await database();
  if (webhook.type !== "email.delivered" && webhook.type !== "email.opened") {
    return null;
  }
  const existing = await db
    .select()
    .from(interaction)
    .where(
      and(
        eq(interaction.providerRef, webhook.data.email_id),
        eq(
          interaction.kind,
          webhook.type === "email.opened" ? "opened" : "delivered",
        ),
      ),
    )
    .limit(1);
  if (existing[0] !== undefined) {
    return InteractionSchema.parse(existing[0]);
  }
  const messages = await db
    .select()
    .from(message)
    .where(eq(message.providerRef, webhook.data.email_id))
    .limit(1);
  const matchedMessage = messages[0];
  if (matchedMessage === undefined) {
    throw new WebhookIngestionError(
      "message_not_found",
      "No email message matches this provider reference.",
      404,
    );
  }
  const kind = webhook.type === "email.opened" ? "opened" : "delivered";
  const occurredAt = new Date(webhook.created_at);
  const interactions = await db
    .insert(interaction)
    .values({
      campaignId: matchedMessage.campaignId,
      targetId: matchedMessage.targetId,
      messageId: matchedMessage.id,
      channel: "email",
      kind,
      providerRef: webhook.data.email_id,
      occurredAt,
      payload: webhook,
    })
    .returning();
  const created = InteractionSchema.parse(interactions[0]);
  if (kind === "delivered") {
    await db
      .update(message)
      .set({ status: "delivered", updatedAt: occurredAt })
      .where(eq(message.id, matchedMessage.id));
    await db
      .update(target)
      .set({ status: "delivered", updatedAt: occurredAt })
      .where(eq(target.id, matchedMessage.targetId));
  }
  publishSseEvent({
    id: crypto.randomUUID(),
    type: "interaction.received",
    runId: matchedMessage.runId,
    campaignId: matchedMessage.campaignId,
    occurredAt: occurredAt.toISOString(),
    data: { interaction: created, channel: "email", kind },
  });
  return created;
}

/** Applies a verified Twilio delivery callback to the message and target grid state. */
export async function ingestTwilioStatus(
  webhook: z.output<typeof TwilioStatusWebhookSchema>,
) {
  const db = await database();
  if (webhook.MessageStatus !== "delivered" && webhook.MessageStatus !== "failed") {
    return null;
  }
  const existing = await db
    .select()
    .from(interaction)
    .where(
      and(
        eq(interaction.providerRef, webhook.MessageSid),
        eq(
          interaction.kind,
          webhook.MessageStatus === "failed" ? "bounced" : "delivered",
        ),
      ),
    )
    .limit(1);
  if (existing[0] !== undefined) {
    return InteractionSchema.parse(existing[0]);
  }
  const messages = await db
    .select()
    .from(message)
    .where(eq(message.providerRef, webhook.MessageSid))
    .limit(1);
  const matchedMessage = messages[0];
  if (matchedMessage === undefined) {
    throw new WebhookIngestionError(
      "message_not_found",
      "No WhatsApp message matches this provider reference.",
      404,
    );
  }
  const occurredAt = new Date();
  const failed = webhook.MessageStatus === "failed";
  await db
    .update(message)
    .set({ status: failed ? "failed" : "delivered", updatedAt: occurredAt })
    .where(eq(message.id, matchedMessage.id));
  if (!failed) {
    await db
      .update(target)
      .set({ status: "delivered", updatedAt: occurredAt })
      .where(eq(target.id, matchedMessage.targetId));
  }
  const interactions = await db
    .insert(interaction)
    .values({
      campaignId: matchedMessage.campaignId,
      targetId: matchedMessage.targetId,
      messageId: matchedMessage.id,
      channel: "whatsapp",
      kind: failed ? "bounced" : "delivered",
      providerRef: webhook.MessageSid,
      occurredAt,
      payload: webhook,
    })
    .returning();
  const created = InteractionSchema.parse(interactions[0]);
  publishSseEvent({
    id: crypto.randomUUID(),
    type: "interaction.received",
    runId: matchedMessage.runId,
    campaignId: matchedMessage.campaignId,
    occurredAt: occurredAt.toISOString(),
    data: {
      interaction: created,
      channel: "whatsapp",
      kind: failed ? "bounced" : "delivered",
    },
  });
  return created;
}

function whatsappPhone(value: string) {
  return value.trim().replace(/^whatsapp:/i, "");
}

/** Classifies and persists a verified WhatsApp reply, then publishes its grid event. */
export async function ingestTwilioReply(
  webhook: z.output<typeof TwilioWebhookRequestSchema>,
) {
  const db = await database();
  const existing = await db
    .select()
    .from(interaction)
    .where(eq(interaction.providerRef, webhook.MessageSid))
    .limit(1);
  if (existing[0] !== undefined) {
    return InteractionSchema.parse(existing[0]);
  }
  const senderAddress = whatsappPhone(webhook.From);
  const contacts = await db
    .select()
    .from(contact)
    .where(
      and(
        eq(contact.channel, "whatsapp"),
        eq(contact.address, senderAddress),
      ),
    )
    .limit(1);
  let matchedContact = contacts[0];
  let matchedMessage: typeof message.$inferSelect | undefined;
  let matchedOverrideRecipient = false;
  const deliveryOverride = process.env.WHATSAPP_TO;
  if (
    matchedContact === undefined &&
    deliveryOverride !== undefined &&
    whatsappPhone(deliveryOverride).toLowerCase() === senderAddress.toLowerCase()
  ) {
    // Only a ledgered send proves that this override address received this message.
    const overrideDeliveries = await db
      .select({ matchedContact: contact, matchedMessage: message })
      .from(toolCall)
      .innerJoin(
        message,
        sql`${message.id}::text = ${toolCall.input} ->> 'messageId'`,
      )
      .innerJoin(contact, eq(contact.id, message.contactId))
      .where(
        and(
          eq(toolCall.capabilityId, "message.send"),
          eq(message.channel, "whatsapp"),
          sql`${toolCall.input} ->> 'channel' = 'whatsapp'`,
          sql`lower(trim(${toolCall.input} ->> 'to')) = ${deliveryOverride
            .trim()
            .toLowerCase()}`,
        ),
      )
      .orderBy(desc(toolCall.createdAt))
      .limit(1);
    const overrideDelivery = overrideDeliveries[0];
    if (overrideDelivery !== undefined) {
      matchedContact = overrideDelivery.matchedContact;
      matchedMessage = overrideDelivery.matchedMessage;
      matchedOverrideRecipient = true;
    }
  }
  if (matchedContact === undefined) {
    throw new WebhookIngestionError(
      "contact_not_found",
      "No WhatsApp contact matches this sender.",
      404,
    );
  }
  if (matchedMessage === undefined) {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.contactId, matchedContact.id))
      .orderBy(desc(message.sentAt))
      .limit(1);
    matchedMessage = messages[0];
  }
  const classified = await runReplyClassifier({
    campaignId: matchedContact.campaignId,
    targetId: matchedContact.targetId,
    messageId: matchedMessage === undefined ? null : matchedMessage.id,
    channel: "whatsapp",
    text: webhook.Body,
  });
  if (!classified.ok) {
    throw new WebhookIngestionError(
      "classification_failed",
      classified.reason,
      502,
    );
  }
  const kind =
    classified.data.intent === "opt_out"
      ? "opt_out"
      : classified.data.intent === "meeting_request"
        ? "meeting_booked"
        : "reply";
  const interactions = await db
    .insert(interaction)
    .values({
      campaignId: matchedContact.campaignId,
      targetId: matchedContact.targetId,
      messageId: matchedMessage === undefined ? null : matchedMessage.id,
      channel: "whatsapp",
      kind,
      providerRef: webhook.MessageSid,
      body: webhook.Body,
      occurredAt: new Date(),
      payload: classified.data,
    })
    .returning();
  const created = InteractionSchema.parse(interactions[0]);
  const nextStatus = kind === "opt_out" ? "suppressed" : "engaged";
  await db
    .update(target)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(target.id, matchedContact.targetId));
  if (kind === "opt_out") {
    await db
      .insert(suppression)
      .values({
        workspaceId: await workspaceIdForRun(matchedContact.campaignId),
        campaignId: matchedContact.campaignId,
        scope: "campaign",
        channel: "whatsapp",
        address: matchedOverrideRecipient ? senderAddress : matchedContact.address,
        reason: "Recipient opted out by WhatsApp reply.",
      })
      .onConflictDoNothing();
  }

  const runId =
    matchedMessage === undefined
      ? await latestRunId(matchedContact.campaignId)
      : matchedMessage.runId;
  if (runId !== null) {
    publishSseEvent({
      id: crypto.randomUUID(),
      type: "interaction.received",
      runId,
      campaignId: matchedContact.campaignId,
      occurredAt: created.occurredAt.toISOString(),
      data: { interaction: created, channel: "whatsapp", kind },
    });
    publishSseEvent({
      id: crypto.randomUUID(),
      type: "target.state",
      runId,
      campaignId: matchedContact.campaignId,
      occurredAt: new Date().toISOString(),
      data: {
        targetId: matchedContact.targetId,
        from: null,
        to: nextStatus,
        reason: "Inbound WhatsApp reply received.",
      },
    });
  }
  return created;
}

async function latestRunId(campaignId: string) {
  const db = await database();
  const runs = await db
    .select({ id: run.id })
    .from(run)
    .where(eq(run.campaignId, campaignId))
    .orderBy(desc(run.createdAt))
    .limit(1);
  return runs[0] === undefined ? null : runs[0].id;
}

async function workspaceIdForRun(campaignId: string) {
  const db = await database();
  const campaigns = await db
    .select({ workspaceId: campaign.workspaceId })
    .from(campaign)
    .where(eq(campaign.id, campaignId))
    .limit(1);
  if (campaigns[0] === undefined) {
    throw new WebhookIngestionError("campaign_not_found", "Campaign not found.", 404);
  }
  return campaigns[0].workspaceId;
}
