import {
  ResendWebhookRequestSchema,
  WebhookResponseSchema,
} from "../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import {
  ingestResendEvent,
  WebhookIngestionError,
} from "@/lib/inbound-webhooks";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const resend = new Resend(process.env.RESEND_API_KEY ?? "");
    const verified = resend.webhooks.verify({
      payload: body,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    });
    const input = ResendWebhookRequestSchema.parse(verified);
    await ingestResendEvent(input);
    return NextResponse.json(WebhookResponseSchema.parse({ received: true }));
  } catch (error) {
    if (error instanceof WebhookIngestionError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("resend_webhook_failed", errorMessage(error), 400);
  }
}
