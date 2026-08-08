import {
  CampaignDetailRequestSchema,
  CampaignDetailResponseSchema,
  DeleteCampaignRequestSchema,
  DeleteCampaignResponseSchema,
} from "../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import {
  campaignDetail,
  CampaignApiError,
  deleteCampaign,
} from "@/lib/campaigns";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const input = CampaignDetailRequestSchema.parse({ campaignId: params.id });
    const result = CampaignDetailResponseSchema.parse(
      await campaignDetail(input.campaignId),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CampaignApiError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("campaign_detail_failed", errorMessage(error), 400);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const input = DeleteCampaignRequestSchema.parse({ campaignId: params.id });
    const result = DeleteCampaignResponseSchema.parse(
      await deleteCampaign(input.campaignId),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CampaignApiError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("campaign_delete_failed", errorMessage(error), 400);
  }
}
