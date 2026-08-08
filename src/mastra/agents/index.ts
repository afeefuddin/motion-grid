export * from "./assessor";
export * from "./drafter";
export * from "./evidence-extractor";
export * from "./models";
export * from "./objective-compiler";
export * from "./planner";
export * from "./reply-classifier";
export * from "./runner";

import { assessor } from "./assessor";
import { drafter } from "./drafter";
import { evidenceExtractor } from "./evidence-extractor";
import { objectiveCompiler } from "./objective-compiler";
import { planner } from "./planner";
import { replyClassifier } from "./reply-classifier";

export const agentRegistry = {
  objectiveCompiler,
  planner,
  evidenceExtractor,
  assessor,
  drafter,
  replyClassifier,
};
