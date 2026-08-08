import { campaignObjectiveSchema, campaignPlanSchema } from "@motiongrid/domain";
import { NextResponse } from "next/server";
import { mastraClient } from "@/lib/mastra-client";

export async function POST(request: Request) {
  const parsed = campaignObjectiveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "The campaign objective is incomplete.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const workflow = mastraClient.getWorkflow("plan-campaign");
    const run = await workflow.createRun();
    const result = await run.startAsync({ inputData: parsed.data });

    if (result.status !== "success") {
      return NextResponse.json(
        { error: "Campaign planning did not complete.", status: result.status },
        { status: 502 },
      );
    }

    return NextResponse.json(campaignPlanSchema.parse(result.result));
  } catch (error) {
    return NextResponse.json(
      {
        error: "The Mastra runtime is unavailable. Start it with npm run dev:agents.",
        detail: error instanceof Error ? error.message : "Unknown runtime error",
      },
      { status: 503 },
    );
  }
}
