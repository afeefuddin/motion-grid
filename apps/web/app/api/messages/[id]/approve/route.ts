import {
  ApproveMessageRequestSchema,
  ApproveMessageResponseSchema,
} from "../../../../../../../src/contracts/api";
import { apiError } from "@/lib/api-response";
import {
  approveAndDeliverMessage,
  providerErrorResponse,
} from "@/lib/live-messages";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const body: unknown = await request.json();
    const input = ApproveMessageRequestSchema.parse({
      ...bodyObject(body),
      messageId: params.id,
    });
    const result = ApproveMessageResponseSchema.parse(
      await approveAndDeliverMessage(input),
    );
    return NextResponse.json(result);
  } catch (error) {
    const mapped = providerErrorResponse(error);
    return apiError(mapped.code, mapped.message, mapped.status);
  }
}

function bodyObject(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}
