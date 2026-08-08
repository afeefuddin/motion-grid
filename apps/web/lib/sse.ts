import { SseEventSchema, type SseEvent } from "../../../src/contracts/api";
import { mastraClient } from "./mastra-client";

type Listener = (event: SseEvent) => void;

const encoder = new TextEncoder();
const history = new Map<string, SseEvent[]>();
const listeners = new Map<string, Set<Listener>>();
const MAX_HISTORY = 500;

/** Publishes a validated API event immediately to every listener for its run. */
export function publishSseEvent(value: unknown) {
  const event = SseEventSchema.parse(value);
  const events = history.get(event.runId) ?? [];
  events.push(event);
  if (events.length > MAX_HISTORY) {
    events.shift();
  }
  history.set(event.runId, events);

  for (const listener of listeners.get(event.runId) ?? []) {
    listener(event);
  }
  return event;
}

function serialize(event: SseEvent, streamId = event.id) {
  return encoder.encode(
    `id: ${streamId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

function extractWorkflowEvent(value: unknown): SseEvent | null {
  const direct = SseEventSchema.safeParse(value);
  if (direct.success) {
    return direct.data;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if ("output" in value) {
    const output = extractWorkflowEvent(value.output);
    if (output !== null) {
      return output;
    }
  }
  if ("payload" in value) {
    return extractWorkflowEvent(value.payload);
  }
  return null;
}

function mastraOffset(lastEventId: string | undefined) {
  if (lastEventId === undefined || !lastEventId.startsWith("mastra:")) {
    return 0;
  }
  const offset = Number.parseInt(lastEventId.slice("mastra:".length), 10);
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}

/**
 * Observes Mastra's durable run stream while also forwarding web-originated events.
 * This connection can disappear without affecting workflow execution.
 */
export function openSseStream(
  runId: string,
  lastEventId: string | undefined,
  signal: AbortSignal,
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      controller.enqueue(encoder.encode(": connected\n\n"));
      let replay = history.get(runId) ?? [];
      if (lastEventId !== undefined && !lastEventId.startsWith("mastra:")) {
        const index = replay.findIndex((event) => event.id === lastEventId);
        replay = index === -1 ? replay : replay.slice(index + 1);
      }
      for (const event of replay) {
        controller.enqueue(serialize(event));
      }

      const listener: Listener = (event) => controller.enqueue(serialize(event));
      const runListeners = listeners.get(runId) ?? new Set<Listener>();
      runListeners.add(listener);
      listeners.set(runId, runListeners);

      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 15_000);
      const cleanup = () => {
        if (closed) {
          return false;
        }
        closed = true;
        clearInterval(heartbeat);
        runListeners.delete(listener);
        if (runListeners.size === 0) {
          listeners.delete(runId);
        }
        return true;
      };
      const close = () => {
        if (!cleanup()) {
          return;
        }
        controller.close();
      };
      signal.addEventListener("abort", close, { once: true });

      try {
        const workflow = mastraClient.getWorkflow("campaignWorkflow");
        const run = await workflow.createRun({ runId });
        const offset = mastraOffset(lastEventId);
        const stream = await run.observe({ offset });
        let cursor = offset;
        for await (const chunk of stream) {
          if (closed) {
            break;
          }
          cursor += 1;
          const event = extractWorkflowEvent(chunk.payload);
          if (event !== null) {
            controller.enqueue(serialize(event, `mastra:${cursor}`));
          }
        }
      } catch (error) {
        if (cleanup()) {
          controller.error(error);
        }
      }
    },
  });
}
