import { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import type {
  CapabilityInput,
  CapabilityOutput,
} from "../../capabilities/registry";

const WhatsAppWebResponseSchema = z.object({
  messageId: z.string().min(1).nullable().optional(),
  requestId: z.string().min(1).optional(),
  status: z.string().optional(),
});
const WhatsAppWebFailureSchema = z.object({
  error: z.string().optional(),
});

export interface WhatsAppWebConfig {
  baseUrl: string;
  apiKey: string;
  from: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class WhatsAppWebError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "WhatsAppWebError";
  }
}

/** Sends policy-approved WhatsApp messages through the hosted whatsapp-web.js API. */
export class WhatsAppWebAdapter implements Adapter<"message.send"> {
  readonly id = "whatsapp-web.whatsapp";
  readonly provides: readonly ["message.send"] = ["message.send"];
  readonly mode = "live";
  readonly unitCost: Adapter<"message.send">["unitCost"] = {
    unit: "message",
    operatingCents: 0,
    commitCents: 0,
    projected: false,
  };
  readonly profile = {
    coverage: { geographies: ["IN", "global"], categories: ["all"] },
    freshnessDays: 0,
    expectedConfidence: 0.98,
    rateLimitPerMinute: 60,
    writesExternalState: true,
    productionPath: "Hosted whatsapp-web.js service",
  };
  private readonly baseUrl: URL;
  private readonly from: string;
  private readonly request: typeof fetch;

  constructor(private readonly config: WhatsAppWebConfig) {
    if (!config.apiKey.trim()) {
      throw new WhatsAppWebError(
        "WHATSAPP_SERVICE_API_KEY is required.",
        "missing_configuration",
        503,
      );
    }

    try {
      this.baseUrl = new URL(config.baseUrl);
    } catch {
      throw new WhatsAppWebError(
        "WHATSAPP_SERVICE_URL must be a valid HTTPS URL.",
        "missing_configuration",
        503,
      );
    }

    if (this.baseUrl.protocol !== "https:") {
      throw new WhatsAppWebError(
        "WHATSAPP_SERVICE_URL must use HTTPS.",
        "missing_configuration",
        503,
      );
    }

    this.from = whatsappAddress(config.from);
    this.request = config.fetchImpl ?? globalThis.fetch;
  }

  async execute(
    capabilityId: "message.send",
    input: CapabilityInput<"message.send">,
  ): Promise<CapabilityOutput<"message.send">> {
    if (capabilityId !== "message.send" || input.channel !== "whatsapp") {
      throw new WhatsAppWebError(
        "The WhatsApp Web adapter only supports message.send on WhatsApp.",
        "unsupported_channel",
        422,
      );
    }
    if (input.subject !== null) {
      throw new WhatsAppWebError(
        "WhatsApp messages cannot have a subject.",
        "invalid_subject",
        422,
      );
    }
    if (whatsappAddress(input.from) !== this.from) {
      throw new WhatsAppWebError(
        "The message sender does not match WHATSAPP_FROM.",
        "invalid_sender",
        422,
      );
    }

    try {
      const response = await this.request(new URL("/messages/send", this.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: whatsappAddress(input.to).slice(1), message: input.body }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      });
      const rawPayload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const failure = WhatsAppWebFailureSchema.safeParse(rawPayload);
        throw new WhatsAppWebError(
          failure.success && failure.data.error !== undefined
            ? failure.data.error
            : `WhatsApp service returned HTTP ${response.status}.`,
          "whatsapp_web_error",
          response.status,
        );
      }

      const payload = WhatsAppWebResponseSchema.parse(rawPayload);
      const providerRef = payload.messageId ?? payload.requestId;
      if (providerRef === undefined) {
        throw new WhatsAppWebError(
          "WhatsApp service did not return a provider reference.",
          "invalid_provider_response",
          502,
        );
      }

      return {
        providerRef,
        status: payload.status === "sent" ? "sent" : "accepted",
        acceptedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof WhatsAppWebError) {
        throw error;
      }

      throw new WhatsAppWebError(
        error instanceof Error ? error.message : "WhatsApp service request failed.",
        "network_error",
      );
    }
  }
}

function whatsappAddress(value: string) {
  return value.trim().replace(/^whatsapp:/, "");
}
