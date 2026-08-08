import twilio from "twilio";

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  from: string;
  statusCallback?: string;
}

export interface SendWhatsAppInput {
  to: string;
  body: string;
}

export interface SendWhatsAppResult {
  provider: "twilio";
  channel: "whatsapp";
  messageId: string;
  status: string;
}

export class TwilioWhatsAppError extends Error {
  constructor(
    message: string,
    readonly code?: number | string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "TwilioWhatsAppError";
  }
}

function whatsappAddress(value: string) {
  const phoneNumber = value.trim().replace(/^whatsapp:/, "");

  if (!E164_PHONE_NUMBER.test(phoneNumber)) {
    throw new Error("WhatsApp numbers must use E.164 format, for example +919876543210.");
  }

  return `whatsapp:${phoneNumber}`;
}

export class TwilioWhatsAppAdapter {
  private readonly client: ReturnType<typeof twilio>;
  private readonly from: string;

  constructor(private readonly config: TwilioWhatsAppConfig) {
    if (!config.accountSid.trim()) {
      throw new Error("TWILIO_ACCOUNT_SID is required.");
    }

    if (!config.authToken.trim()) {
      throw new Error("TWILIO_AUTH_TOKEN is required.");
    }

    this.from = whatsappAddress(config.from);
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    try {
      const message = await this.client.messages.create({
        from: this.from,
        to: whatsappAddress(input.to),
        body: input.body,
        ...(this.config.statusCallback ? { statusCallback: this.config.statusCallback } : {}),
      });

      return {
        provider: "twilio",
        channel: "whatsapp",
        messageId: message.sid,
        status: message.status,
      };
    } catch (error) {
      const twilioError = error as { message?: unknown; code?: unknown; status?: unknown };

      throw new TwilioWhatsAppError(
        typeof twilioError.message === "string" ? twilioError.message : "Twilio delivery failed.",
        typeof twilioError.code === "string" || typeof twilioError.code === "number"
          ? twilioError.code
          : undefined,
        typeof twilioError.status === "number" ? twilioError.status : undefined,
      );
    }
  }
}

export function validateTwilioWebhook(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}) {
  if (!input.authToken || !input.signature) {
    return false;
  }

  return twilio.validateRequest(input.authToken, input.signature, input.url, input.params);
}
