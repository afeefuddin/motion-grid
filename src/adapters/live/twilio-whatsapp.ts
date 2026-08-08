import twilio from "twilio";
import { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import type {
  CapabilityInput,
  CapabilityOutput,
} from "../../capabilities/registry";

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;
const TwilioFailureSchema = z.object({
  message: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
  status: z.number().optional(),
});

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  from: string;
  statusCallback?: string;
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
    throw new TwilioWhatsAppError(
      "WhatsApp numbers must use E.164 format, for example +919876543210.",
      "invalid_recipient",
      422,
    );
  }

  return `whatsapp:${phoneNumber}`;
}

/** Sends policy-approved WhatsApp messages through the Twilio sandbox. */
export class TwilioWhatsAppAdapter implements Adapter<"message.send"> {
  readonly id = "twilio.whatsapp";
  readonly provides: readonly ["message.send"] = ["message.send"];
  readonly mode = "live";
  readonly unitCost: Adapter<"message.send">["unitCost"] = {
    unit: "message",
    operatingCents: 0.5,
    commitCents: 0,
    projected: false,
  };
  readonly profile = {
    coverage: { geographies: ["IN", "global"], categories: ["all"] },
    freshnessDays: 0,
    expectedConfidence: 0.99,
    rateLimitPerMinute: 80,
    writesExternalState: true,
    productionPath: "Twilio WhatsApp Sandbox",
  };
  private readonly client: ReturnType<typeof twilio>;
  private readonly from: string;

  constructor(private readonly config: TwilioWhatsAppConfig) {
    if (!config.accountSid.trim()) {
      throw new TwilioWhatsAppError(
        "TWILIO_ACCOUNT_SID is required.",
        "missing_configuration",
        503,
      );
    }
    if (!config.authToken.trim()) {
      throw new TwilioWhatsAppError(
        "TWILIO_AUTH_TOKEN is required.",
        "missing_configuration",
        503,
      );
    }

    this.from = whatsappAddress(config.from);
    this.client = twilio(config.accountSid, config.authToken);
  }

  /**
   * Sends one WhatsApp message.
   *
   * @param capabilityId - Must be `message.send`.
   * @param input - A WhatsApp message whose sender matches the configured sandbox sender.
   * @return The accepted provider reference and timestamp.
   * @raise [TwilioWhatsAppError] when validation or Twilio delivery fails.
   */
  async execute(
    capabilityId: "message.send",
    input: CapabilityInput<"message.send">,
  ): Promise<CapabilityOutput<"message.send">> {
    if (capabilityId !== "message.send" || input.channel !== "whatsapp") {
      throw new TwilioWhatsAppError(
        "The Twilio adapter only supports message.send on WhatsApp.",
        "unsupported_channel",
        422,
      );
    }
    if (input.subject !== null) {
      throw new TwilioWhatsAppError(
        "WhatsApp messages cannot have a subject.",
        "invalid_subject",
        422,
      );
    }
    if (whatsappAddress(input.from) !== this.from) {
      throw new TwilioWhatsAppError(
        "The message sender does not match TWILIO_WHATSAPP_FROM.",
        "invalid_sender",
        422,
      );
    }

    try {
      const message = await this.client.messages.create({
        from: this.from,
        to: whatsappAddress(input.to),
        body: input.body,
        ...(this.config.statusCallback
          ? { statusCallback: this.config.statusCallback }
          : {}),
      });

      return {
        providerRef: message.sid,
        status: message.status === "sent" ? "sent" : "accepted",
        acceptedAt: new Date().toISOString(),
      };
    } catch (error) {
      const parsed = TwilioFailureSchema.safeParse(error);
      throw new TwilioWhatsAppError(
        parsed.success && parsed.data.message !== undefined
          ? parsed.data.message
          : "Twilio delivery failed.",
        parsed.success ? parsed.data.code : undefined,
        parsed.success ? parsed.data.status : undefined,
      );
    }
  }
}

/** Verifies the signature Twilio computes over the externally visible request URL. */
export function validateTwilioWebhook(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}) {
  if (!input.authToken || !input.signature) {
    return false;
  }

  return twilio.validateRequest(
    input.authToken,
    input.signature,
    input.url,
    input.params,
  );
}
