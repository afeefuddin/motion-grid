import { SseEventSchema, type SseEvent } from "../../../src/contracts/api";

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

function serialize(event: SseEvent) {
  return encoder.encode(
    `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

/** Creates a replayable event stream and keeps it alive through proxy idle windows. */
export function openSseStream(
  runId: string,
  lastEventId: string | undefined,
  signal: AbortSignal,
) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let replay = history.get(runId) ?? [];
      if (lastEventId !== undefined) {
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
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);
      const close = () => {
        clearInterval(heartbeat);
        runListeners.delete(listener);
        if (runListeners.size === 0) {
          listeners.delete(runId);
        }
        controller.close();
      };
      signal.addEventListener("abort", close, { once: true });
    },
  });
}
