import { Resend, type CreateEmailOptions } from "resend";

export interface ResendEmailConfig {
  apiKey: string;
  from: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  idempotencyKey?: string;
}

export interface SendEmailResult {
  provider: "resend";
  messageId: string;
  status: "accepted";
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

export class ResendEmailAdapter {
  private readonly client: Resend;

  constructor(private readonly config: ResendEmailConfig) {
    if (!config.apiKey.trim()) {
      throw new Error("RESEND_API_KEY is required.");
    }

    if (!config.from.trim()) {
      throw new Error("RESEND_FROM_EMAIL is required.");
    }

    this.client = new Resend(config.apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!input.html && !input.text) {
      throw new Error("An HTML or plain-text email body is required.");
    }

    const base = {
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    };
    const email: CreateEmailOptions = input.html
      ? { ...base, html: input.html, ...(input.text ? { text: input.text } : {}) }
      : { ...base, text: input.text! };
    const response = await this.client.emails.send(
      email,
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );

    if (response.error) {
      throw new ResendEmailError(
        response.error.message,
        response.error.name,
        response.error.statusCode,
      );
    }

    return {
      provider: "resend",
      messageId: response.data.id,
      status: "accepted",
    };
  }
}
