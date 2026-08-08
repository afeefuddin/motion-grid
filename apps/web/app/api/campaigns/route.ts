import {
  CreateCampaignRequestSchema,
  CreateCampaignResponseSchema,
  ListCampaignsRequestSchema,
  ListCampaignsResponseSchema,
} from "../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import { createCampaign, listCampaigns } from "@/lib/campaigns";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const input = CreateCampaignRequestSchema.parse(await request.json());
    const result = CreateCampaignResponseSchema.parse(await createCampaign(input));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError("campaign_create_failed", errorMessage(error), 400);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = ListCampaignsRequestSchema.parse({
      workspaceId: url.searchParams.get("workspaceId"),
    });
    const result = ListCampaignsResponseSchema.parse({
      campaigns: await listCampaigns(input.workspaceId),
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError("campaign_list_failed", errorMessage(error), 400);
  }
}
