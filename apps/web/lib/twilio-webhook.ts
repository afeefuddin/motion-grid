import { validateTwilioWebhook } from "@motiongrid/integrations";

function externallyVisibleUrl(requestUrl: string) {
  const incomingUrl = new URL(requestUrl);
  const baseUrl = process.env.PUBLIC_WEBHOOK_URL;

  if (!baseUrl) {
    return incomingUrl.toString();
  }

  return new URL(`${incomingUrl.pathname}${incomingUrl.search}`, baseUrl).toString();
}

export async function readTwilioWebhook(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  return {
    params,
    valid: validateTwilioWebhook({
      authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
      signature: request.headers.get("x-twilio-signature") ?? "",
      url: externallyVisibleUrl(request.url),
      params,
    }),
  };
}
