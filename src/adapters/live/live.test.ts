import assert from "node:assert/strict";
import test from "node:test";
import {
  ResendEmailAdapter,
  ResendEmailError,
  TwilioWhatsAppAdapter,
  TwilioWhatsAppError,
} from "./index";

test("live adapters expose honest message.send ranking metadata", () => {
  const twilio = new TwilioWhatsAppAdapter({
    accountSid: "AC00000000000000000000000000000000",
    authToken: "test-token",
    from: "+14155238886",
  });
  const resend = new ResendEmailAdapter({
    apiKey: "re_test",
    from: "MotionGrid <onboarding@resend.dev>",
  });

  assert.deepEqual(twilio.provides, ["message.send"]);
  assert.equal(twilio.mode, "live");
  assert.equal(twilio.profile.writesExternalState, true);
  assert.deepEqual(resend.provides, ["message.send"]);
  assert.equal(resend.mode, "live");
  assert.equal(resend.profile.writesExternalState, true);
});

test("Twilio rejects a non-WhatsApp capability input before network access", async () => {
  const adapter = new TwilioWhatsAppAdapter({
    accountSid: "AC00000000000000000000000000000000",
    authToken: "test-token",
    from: "+14155238886",
  });

  await assert.rejects(
    adapter.execute("message.send", {
      messageId: crypto.randomUUID(),
      channel: "email",
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      body: "Hello",
      idempotencyKey: "test",
    }),
    TwilioWhatsAppError,
  );
});

test("Resend rejects a non-email capability input before network access", async () => {
  const adapter = new ResendEmailAdapter({
    apiKey: "re_test",
    from: "MotionGrid <onboarding@resend.dev>",
  });

  await assert.rejects(
    adapter.execute("message.send", {
      messageId: crypto.randomUUID(),
      channel: "whatsapp",
      from: "+14155238886",
      to: "+919876543210",
      subject: null,
      body: "Hello",
      idempotencyKey: "test",
    }),
    ResendEmailError,
  );
});
