import {
  StartRunRequestSchema,
  StartRunResponseSchema,
} from "../../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import { CampaignApiError, startRun } from "@/lib/campaigns";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const body: unknown = await request.json();
    const input = StartRunRequestSchema.parse({
      ...bodyObject(body),
      campaignId: params.id,
    });
    const result = StartRunResponseSchema.parse({ run: await startRun(input) });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof CampaignApiError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("run_start_failed", errorMessage(error), 400);
  }
}

function bodyObject(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}
