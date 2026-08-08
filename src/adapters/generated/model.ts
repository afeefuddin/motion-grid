import { z } from "zod";
import { SimWorldSchema } from "../../sim/schema";
import type { GeneratedWorldRequest, GenerateWorld } from "./store";

const ResponseSchema = z.object({
  output_text: z.string().min(1),
});

/**
 * Calls the Responses API once to create an artifact-only market world.
 *
 * @throws when credentials are absent, the network request fails, or output is invalid
 */
export const generateWorldWithOpenAI: GenerateWorld = async (
  request: GeneratedWorldRequest,
) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      "OPENAI_API_KEY is required on a generated-market cache miss.",
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_GENERATED_MARKET_MODEL ?? "gpt-5.4",
        input: [
          {
            role: "developer",
            content:
              "Create a deterministic synthetic Indian local market. Emit artifacts only: business facts, website HTML, reviews, contacts, creators, and posts. Never emit findings, qualifications, recommendations, or scores. Website defects must exist in the HTML. Reviews must sound like concise Indian Google Maps reviews. IDs must include the seed and be stable. Return exactly 60 businesses and 24 creators.",
          },
          {
            role: "user",
            content: `Geography: ${request.geography}\nCategory: ${request.category}\nCentre: ${request.latitude}, ${request.longitude}\nSeed: ${request.seed}\nRequested discovery limit: ${request.limit}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "generated_market_world",
            strict: true,
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
    return JSON.parse(payload.output_text);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Generated-market synthesis failed: ${error.message}`);
    }
    throw new Error("Generated-market synthesis failed with an unknown error.");
  }
};
