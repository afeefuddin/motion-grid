import { z } from "zod";
import { SimWorldSchema } from "../../sim/schema";
import type { GeneratedWorldRequest, GenerateWorld } from "./store";

const ResponseSchema = z.object({
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * Calls Claude once to create an artifact-only market world.
 *
 * @throws when credentials are absent, the network request fails, or output is invalid
 */
export const generateWorldWithClaude: GenerateWorld = async (
  request: GeneratedWorldRequest,
) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      "ANTHROPIC_API_KEY is required on a generated-market cache miss.",
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.ANTHROPIC_GENERATED_MARKET_MODEL ??
          "claude-sonnet-4-6",
        max_tokens: 32_000,
        system:
          "Create a deterministic synthetic Indian local market. Emit artifacts only: business facts, website HTML, reviews, contacts, creators, and posts. Never emit findings, qualifications, recommendations, or scores. Website defects must exist in the HTML. Reviews must sound like concise Indian Google Maps reviews. IDs must include the seed and be stable. Return exactly 60 businesses and 24 creators.",
        messages: [
          {
            role: "user",
            content: `Geography: ${request.geography}\nCategory: ${request.category}\nCentre: ${request.latitude}, ${request.longitude}\nSeed: ${request.seed}\nRequested discovery limit: ${request.limit}`,
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: z.toJSONSchema(SimWorldSchema),
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Generated-market model request failed with HTTP ${response.status}.`,
      );
    }
    const payload = ResponseSchema.parse(await response.json());
    return JSON.parse(payload.content.map((block) => block.text).join(""));
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Generated-market synthesis failed: ${error.message}`);
    }
    throw new Error("Generated-market synthesis failed with an unknown error.");
  }
};
