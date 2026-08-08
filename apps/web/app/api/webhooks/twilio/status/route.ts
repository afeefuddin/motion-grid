import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhook = await readTwilioWebhook(request);

  if (!webhook.valid) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }

  console.info("Twilio WhatsApp status changed", {
    messageId: webhook.params.MessageSid,
    status: webhook.params.MessageStatus,
    errorCode: webhook.params.ErrorCode,
  });

  return NextResponse.json({ received: true });
}
