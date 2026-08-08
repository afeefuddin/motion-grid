import {
  TwilioWebhookRequestSchema,
  WebhookResponseSchema,
} from "../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import {
  ingestTwilioReply,
  WebhookIngestionError,
} from "@/lib/inbound-webhooks";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const webhook = await readTwilioWebhook(request);
    if (!webhook.valid) {
      return apiError("invalid_signature", "Invalid Twilio signature.", 401);
    }
    const input = TwilioWebhookRequestSchema.parse(webhook.params);
    await ingestTwilioReply(input);
    return NextResponse.json(WebhookResponseSchema.parse({ received: true }));
  } catch (error) {
    if (error instanceof WebhookIngestionError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("twilio_webhook_failed", errorMessage(error), 400);
  }
}
