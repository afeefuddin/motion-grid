import crypto from "node:crypto";

import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import QRCode from "qrcode";
import whatsappWeb from "whatsapp-web.js";

const { Client, LocalAuth } = whatsappWeb;

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const apiKey = process.env.API_KEY ?? "";
const authPath =
  process.env.WHATSAPP_AUTH_PATH ?? "/var/lib/whatsapp-web-api/auth";
const allowedRecipients = new Set(
  (process.env.ALLOWED_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.replace(/\D/g, ""))
    .filter(Boolean),
);

if (!apiKey || allowedRecipients.size === 0) {
  throw new Error("API_KEY and ALLOWED_RECIPIENTS must be configured.");
}

let state = "starting";
let latestQr = null;
let lastError = null;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "motiongrid", dataPath: authPath }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  },
});

client.on("qr", async (qr) => {
  latestQr = await QRCode.toBuffer(qr, { width: 480, margin: 2 });
  state = "awaiting_qr";
});

client.on("authenticated", () => {
  state = "authenticated";
  latestQr = null;
});

client.on("ready", () => {
  state = "ready";
  lastError = null;
});

client.on("auth_failure", (message) => {
  state = "auth_failure";
  lastError = String(message);
});

client.on("disconnected", (reason) => {
  state = "disconnected";
  lastError = String(reason);
});

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

function authenticated(request, response, next) {
  const supplied =
    request.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(apiKey);
  const suppliedBuffer = Buffer.from(supplied);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  next();
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, state, lastError });
});

app.get("/qr.png", authenticated, (_request, response) => {
  if (!latestQr) {
    return response
      .status(404)
      .json({ error: "No QR code is currently available", state });
  }

  response.type("png").send(latestQr);
});

app.post("/messages/send", authenticated, async (request, response) => {
  const to =
    typeof request.body?.to === "string"
      ? request.body.to.replace(/\D/g, "")
      : "";
  const message =
    typeof request.body?.message === "string"
      ? request.body.message.trim()
      : "";

  if (state !== "ready") {
    return response
      .status(503)
      .json({ error: "WhatsApp client is not ready", state });
  }

  if (!allowedRecipients.has(to)) {
    return response.status(403).json({ error: "Recipient is not allowlisted" });
  }

  if (!message || message.length > 1_600) {
    return response
      .status(422)
      .json({ error: "Message must contain 1 to 1600 characters" });
  }

  try {
    const contactId = await client.getNumberId(to);

    if (!contactId) {
      return response
        .status(404)
        .json({ error: "Recipient is not registered on WhatsApp" });
    }

    const result = await client.sendMessage(contactId._serialized, message);
    return response.status(202).json({
      provider: "whatsapp-web.js",
      messageId: result?.id?._serialized ?? null,
      requestId: crypto.randomUUID(),
      status: "sent",
    });
  } catch (error) {
    console.error("WhatsApp send failed", error);
    return response.status(502).json({
      error: error instanceof Error ? error.message : "WhatsApp send failed",
    });
  }
});

const server = app.listen(port, host, () => {
  console.log(`WhatsApp Web API listening on ${host}:${port}`);
});

client.initialize().catch((error) => {
  state = "failed";
  lastError = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function shutdown() {
  server.close();
  await client.destroy().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
