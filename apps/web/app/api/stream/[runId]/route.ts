import { StreamRequestSchema } from "../../../../../../src/contracts/api";
import { apiError, errorMessage } from "@/lib/api-response";
import { openSseStream } from "@/lib/sse";

export function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  return streamResponse(request, context);
}

async function streamResponse(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const params = await context.params;
    const input = StreamRequestSchema.parse({
      runId: params.runId,
      lastEventId: request.headers.get("last-event-id") ?? undefined,
    });
    return new Response(
      openSseStream(input.runId, input.lastEventId, request.signal),
      {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      },
    );
  } catch (error) {
    return apiError("invalid_stream", errorMessage(error), 400);
  }
}
