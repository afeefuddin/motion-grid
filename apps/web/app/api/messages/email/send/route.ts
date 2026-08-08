import { ResendEmailAdapter, ResendEmailError } from "@motiongrid/integrations";
import { NextResponse } from "next/server";
import { z } from "zod";

const sendEmailSchema = z
  .object({
    to: z.email(),
    subject: z.string().trim().min(1).max(200),
    html: z.string().min(1).max(100_000).optional(),
    text: z.string().min(1).max(50_000).optional(),
    replyTo: z.email().optional(),
  })
  .refine(({ html, text }) => Boolean(html || text), {
    message: "An HTML or plain-text email body is required.",
  });

function allowedRecipients() {
  return new Set(
    (process.env.RESEND_ALLOWED_RECIPIENTS ?? "")
      .split(",")
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = sendEmailSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "The email is incomplete.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const recipients = allowedRecipients();

  if (recipients.size === 0) {
    return NextResponse.json(
      { error: "RESEND_ALLOWED_RECIPIENTS is not configured." },
      { status: 503 },
    );
  }

  if (!recipients.has(parsed.data.to.toLowerCase())) {
    return NextResponse.json(
      { error: "This recipient is not in RESEND_ALLOWED_RECIPIENTS." },
      { status: 403 },
    );
  }

  try {
    const adapter = new ResendEmailAdapter({
      apiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.RESEND_FROM_EMAIL ?? "",
    });
    const result = await adapter.send({
      ...parsed.data,
      idempotencyKey: request.headers.get("idempotency-key") ?? `motiongrid-${crypto.randomUUID()}`,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof ResendEmailError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode ?? 502 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email delivery failed." },
      { status: 500 },
    );
  }
}
