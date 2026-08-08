import "server-only";
import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL ?? "http://localhost:4111",
  retries: 2,
  backoffMs: 250,
  maxBackoffMs: 1_500,
});
