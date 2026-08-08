import {
  TwilioWhatsAppAdapter,
  TwilioWhatsAppError,
} from "../../../../../../../src/adapters/live";
import { NextResponse } from "next/server";
import { z } from "zod";

const e164PhoneNumber = /^\+[1-9]\d{7,14}$/;
const sendWhatsAppSchema = z.object({
  to: z.string().trim().regex(e164PhoneNumber, "Use E.164 format, for example +919876543210."),
  body: z.string().trim().min(1).max(1_600),
});

function allowedRecipients() {
  return new Set(
    (process.env.TWILIO_ALLOWED_RECIPIENTS ?? "")
      .split(",")
      .map((recipient) => recipient.trim())
      .filter(Boolean),
  );
}

function statusCallbackUrl() {
  const publicUrl = process.env.PUBLIC_WEBHOOK_URL;

  return publicUrl
    ? new URL("/api/webhooks/twilio/status", publicUrl).toString()
    : undefined;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = sendWhatsAppSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "The WhatsApp message is incomplete.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const recipients = allowedRecipients();

  if (recipients.size === 0) {
    return NextResponse.json(
      { error: "TWILIO_ALLOWED_RECIPIENTS is not configured." },
      { status: 503 },
    );
  }

  if (!recipients.has(parsed.data.to)) {
    return NextResponse.json(
      { error: "This phone number is not in TWILIO_ALLOWED_RECIPIENTS." },
      { status: 403 },
    );
  }

  try {
    const adapter = new TwilioWhatsAppAdapter({
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
      authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
      from: process.env.TWILIO_WHATSAPP_FROM ?? "",
      statusCallback: statusCallbackUrl(),
    });
    const result = await adapter.send(parsed.data);

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof TwilioWhatsAppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "WhatsApp delivery failed." },
      { status: 500 },
    );
  }
}
