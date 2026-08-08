import { createTool } from "@mastra/core/tools";
import type { Adapter } from "../../capabilities/adapter";
import type { AdapterBinding } from "../../capabilities/binding";
import {
  executeCapability,
  type ToolCallContext,
  type ToolCallWriter,
} from "../../capabilities/execute";
import {
  type CapabilityDefinition,
  type CapabilityInput,
  capabilityRegistry,
} from "../../capabilities/registry";
import {
  AdsPlanInputSchema,
  AdsPlanOutputSchema,
  type CapabilityId,
  DbQueryInputSchema,
  DbQueryOutputSchema,
  GeoQueryInputSchema,
  GeoQueryOutputSchema,
  MessageSendInputSchema,
  MessageSendOutputSchema,
  PeopleFindInputSchema,
  PeopleFindOutputSchema,
  ReviewsFetchInputSchema,
  ReviewsFetchOutputSchema,
  SegmentBuildInputSchema,
  SegmentBuildOutputSchema,
  WebFetchInputSchema,
  WebFetchOutputSchema,
} from "../../contracts/capabilities";

export interface CapabilityToolRuntime<C extends CapabilityId> {
  readonly context: ToolCallContext;
  readonly binding: AdapterBinding<C>;
  readonly adapter: Adapter<C>;
  readonly ledger: ToolCallWriter;
}

export type CapabilityToolRuntimes = {
  readonly [C in CapabilityId]: CapabilityToolRuntime<C>;
};

export const capabilityToolNames = {
  "geo.query": "geo-query",
  "db.query": "db-query",
  "web.fetch": "web-fetch",
  "reviews.fetch": "reviews-fetch",
  "people.find": "people-find",
  "segment.build": "segment-build",
  "message.send": "message-send",
  "ads.plan": "ads-plan",
} satisfies Readonly<Record<CapabilityId, string>>;

function runCapability<C extends CapabilityId>(
  capability: CapabilityDefinition<C>,
  runtime: CapabilityToolRuntime<C>,
  input: CapabilityInput<C>,
) {
  return executeCapability({
    context: runtime.context,
    capability,
    binding: runtime.binding,
    adapter: runtime.adapter,
    input,
    ledger: runtime.ledger,
  });
}

export function createGeoQueryTool(
  runtime: CapabilityToolRuntime<"geo.query">,
) {
  return createTool({
    id: capabilityToolNames["geo.query"],
    description: "Discover local organizations within a geographic radius.",
    inputSchema: GeoQueryInputSchema,
    outputSchema: GeoQueryOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["geo.query"], runtime, input),
  });
}

export function createDbQueryTool(runtime: CapabilityToolRuntime<"db.query">) {
  return createTool({
    id: capabilityToolNames["db.query"],
    description: "Find creators or companies in a structured index.",
    inputSchema: DbQueryInputSchema,
    outputSchema: DbQueryOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["db.query"], runtime, input),
  });
}

export function createWebFetchTool(
  runtime: CapabilityToolRuntime<"web.fetch">,
) {
  return createTool({
    id: capabilityToolNames["web.fetch"],
    description: "Fetch a website artifact for an already discovered target.",
    inputSchema: WebFetchInputSchema,
    outputSchema: WebFetchOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["web.fetch"], runtime, input),
  });
}

export function createReviewsFetchTool(
  runtime: CapabilityToolRuntime<"reviews.fetch">,
) {
  return createTool({
    id: capabilityToolNames["reviews.fetch"],
    description: "Fetch review artifacts for an already discovered target.",
    inputSchema: ReviewsFetchInputSchema,
    outputSchema: ReviewsFetchOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["reviews.fetch"], runtime, input),
  });
}

export function createPeopleFindTool(
  runtime: CapabilityToolRuntime<"people.find">,
) {
  return createTool({
    id: capabilityToolNames["people.find"],
    description: "Find a decision-maker and available contact channels.",
    inputSchema: PeopleFindInputSchema,
    outputSchema: PeopleFindOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["people.find"], runtime, input),
  });
}

export function createSegmentBuildTool(
  runtime: CapabilityToolRuntime<"segment.build">,
) {
  return createTool({
    id: capabilityToolNames["segment.build"],
    description: "Build an addressable first-party audience segment.",
    inputSchema: SegmentBuildInputSchema,
    outputSchema: SegmentBuildOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["segment.build"], runtime, input),
  });
}

export function createMessageSendTool(
  runtime: CapabilityToolRuntime<"message.send">,
) {
  return createTool({
    id: capabilityToolNames["message.send"],
    description: "Send one approved message through its bound channel adapter.",
    inputSchema: MessageSendInputSchema,
    outputSchema: MessageSendOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["message.send"], runtime, input),
  });
}

export function createAdsPlanTool(runtime: CapabilityToolRuntime<"ads.plan">) {
  return createTool({
    id: capabilityToolNames["ads.plan"],
    description: "Estimate an advertising plan for a defined audience segment.",
    inputSchema: AdsPlanInputSchema,
    outputSchema: AdsPlanOutputSchema,
    execute: (input) =>
      runCapability(capabilityRegistry["ads.plan"], runtime, input),
  });
}

export function createCapabilityTools(runtimes: CapabilityToolRuntimes) {
  return {
    geoQuery: createGeoQueryTool(runtimes["geo.query"]),
    dbQuery: createDbQueryTool(runtimes["db.query"]),
    webFetch: createWebFetchTool(runtimes["web.fetch"]),
    reviewsFetch: createReviewsFetchTool(runtimes["reviews.fetch"]),
    peopleFind: createPeopleFindTool(runtimes["people.find"]),
    segmentBuild: createSegmentBuildTool(runtimes["segment.build"]),
    messageSend: createMessageSendTool(runtimes["message.send"]),
    adsPlan: createAdsPlanTool(runtimes["ads.plan"]),
  };
}
