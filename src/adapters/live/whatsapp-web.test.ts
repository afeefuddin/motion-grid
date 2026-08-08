import assert from "node:assert/strict";
import test from "node:test";
import { WhatsAppWebAdapter, WhatsAppWebError } from "./whatsapp-web";

const message = {
  messageId: "11111111-1111-4111-8111-111111111111",
  channel: "whatsapp" as const,
  from: "+917044271050",
  to: "+917827962990",
  subject: null,
  body: "MotionGrid test",
  idempotencyKey: "message-test",
};

test("sends through the hosted service with normalized recipient data", async () => {
  let capturedUrl = "";
  let capturedAuthorization = "";
  let capturedBody = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = input.toString();
    capturedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    capturedBody = String(init?.body);

    return new Response(
      JSON.stringify({
        provider: "whatsapp-web.js",
        messageId: null,
        requestId: "request-123",
        status: "sent",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  };
  const adapter = new WhatsAppWebAdapter({
    baseUrl: "https://wp.example.com",
    apiKey: "test-key",
    from: "+917044271050",
    fetchImpl,
  });

  const result = await adapter.execute("message.send", message);

  assert.equal(capturedUrl, "https://wp.example.com/messages/send");
  assert.equal(capturedAuthorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(capturedBody), {
    to: "917827962990",
    message: "MotionGrid test",
  });
  assert.deepEqual(result, {
    providerRef: "request-123",
    status: "sent",
    acceptedAt: result.acceptedAt,
  });
});

test("preserves upstream errors and status codes", async () => {
  const adapter = new WhatsAppWebAdapter({
    baseUrl: "https://wp.example.com",
    apiKey: "test-key",
    from: "+917044271050",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "WhatsApp client is not ready" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
  });

  await assert.rejects(
    adapter.execute("message.send", message),
    (error: unknown) =>
      error instanceof WhatsAppWebError &&
      error.statusCode === 503 &&
      error.code === "whatsapp_web_error" &&
      error.message === "WhatsApp client is not ready",
  );
});

test("requires an HTTPS service URL", () => {
  assert.throws(
    () =>
      new WhatsAppWebAdapter({
        baseUrl: "http://wp.example.com",
        apiKey: "test-key",
        from: "+917044271050",
      }),
    /must use HTTPS/,
  );
});
