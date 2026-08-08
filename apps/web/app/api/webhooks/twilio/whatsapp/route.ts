import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhook = await readTwilioWebhook(request);

  if (!webhook.valid) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }

  console.info("Twilio WhatsApp message received", {
    messageId: webhook.params.MessageSid,
  });

  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}
