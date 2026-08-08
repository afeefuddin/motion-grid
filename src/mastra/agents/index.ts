export * from "./assessor";
export * from "./creator-selector";
export * from "./drafter";
export * from "./evidence-extractor";
export * from "./location-finder";
export * from "./models";
export * from "./objective-compiler";
export * from "./planner";
export * from "./reply-classifier";
export * from "./runner";

import { assessor } from "./assessor";
import { creatorSelector } from "./creator-selector";
import { drafter } from "./drafter";
import { evidenceExtractor } from "./evidence-extractor";
import { locationFinder } from "./location-finder";
import { objectiveCompiler } from "./objective-compiler";
import { planner } from "./planner";
import { replyClassifier } from "./reply-classifier";

export const agentRegistry = {
  objectiveCompiler,
  planner,
  evidenceExtractor,
  locationFinder,
  assessor,
  creatorSelector,
  drafter,
  replyClassifier,
};
