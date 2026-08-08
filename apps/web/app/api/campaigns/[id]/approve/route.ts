import {
  ApproveCampaignRequestSchema,
  ApproveCampaignResponseSchema,
} from "../../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import { approveCampaign, CampaignApiError } from "@/lib/campaigns";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const body: unknown = await request.json();
    const input = ApproveCampaignRequestSchema.parse({
      ...bodyObject(body),
      campaignId: params.id,
    });
    const result = ApproveCampaignResponseSchema.parse(
      await approveCampaign(input),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CampaignApiError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("campaign_approval_failed", errorMessage(error), 400);
  }
}

function bodyObject(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}
