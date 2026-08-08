import { Resend } from "resend";
import type { Adapter } from "../../capabilities/adapter";
import type {
  CapabilityInput,
  CapabilityOutput,
} from "../../capabilities/registry";

export interface ResendEmailConfig {
  apiKey: string;
  from: string;
}

export class ResendEmailError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number | null,
  ) {
    super(message);
    this.name = "ResendEmailError";
  }
}

/** Sends policy-approved plain-text email through Resend's test domain. */
export class ResendEmailAdapter implements Adapter<"message.send"> {
  readonly id = "resend.email";
  readonly provides: readonly ["message.send"] = ["message.send"];
  readonly mode = "live";
  readonly unitCost: Adapter<"message.send">["unitCost"] = {
    unit: "message",
    operatingCents: 0.01,
    commitCents: 0,
    projected: false,
  };
  readonly profile = {
    coverage: { geographies: ["global"], categories: ["all"] },
    freshnessDays: 0,
    expectedConfidence: 0.995,
    rateLimitPerMinute: 120,
    writesExternalState: true,
    productionPath: "Resend test domain",
  };
  private readonly client: Resend;

  constructor(private readonly config: ResendEmailConfig) {
    if (!config.apiKey.trim()) {
      throw new ResendEmailError(
        "RESEND_API_KEY is required.",
        "missing_configuration",
        503,
      );
    }
    if (!config.from.trim()) {
      throw new ResendEmailError(
        "RESEND_FROM_EMAIL is required.",
        "missing_configuration",
        503,
      );
    }

    this.client = new Resend(config.apiKey);
  }

  /**
   * Sends one plain-text email using the capability idempotency key.
   *
   * @param capabilityId - Must be `message.send`.
   * @param input - An email with a subject and the configured sender.
   * @return The accepted provider reference and timestamp.
   * @raise [ResendEmailError] when validation or Resend delivery fails.
   */
  async execute(
    capabilityId: "message.send",
    input: CapabilityInput<"message.send">,
  ): Promise<CapabilityOutput<"message.send">> {
    if (capabilityId !== "message.send" || input.channel !== "email") {
      throw new ResendEmailError(
        "The Resend adapter only supports message.send on email.",
        "unsupported_channel",
        422,
      );
    }
    if (input.subject === null) {
      throw new ResendEmailError(
        "Email messages require a subject.",
        "invalid_subject",
        422,
      );
    }
    if (input.from.trim().toLowerCase() !== this.config.from.trim().toLowerCase()) {
      throw new ResendEmailError(
        "The message sender does not match RESEND_FROM_EMAIL.",
        "invalid_sender",
        422,
      );
    }

    let response: Awaited<ReturnType<Resend["emails"]["send"]>>;
    try {
      response = await this.client.emails.send(
        {
          from: this.config.from,
          to: input.to,
          subject: input.subject,
          text: input.body,
        },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch (error) {
      throw new ResendEmailError(
        error instanceof Error ? error.message : "Resend delivery failed.",
        "network_error",
        null,
      );
    }

    if (response.error !== null) {
      throw new ResendEmailError(
        response.error.message,
        response.error.name,
        response.error.statusCode,
      );
    }

    return {
      providerRef: response.data.id,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    };
  }
}
