import { asc, eq } from "drizzle-orm";
import type { Assessment } from "../../contracts";
import {
  AssessmentSchema,
  NewAssessmentSchema,
  NewSignalSchema,
} from "../../contracts";
import { db } from "../client";
import { assessment, signal } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewAssessment, NewSignal } from "./types";

export const assessmentRepo = {
  async create(input: NewAssessment, signals: NewSignal[] = []) {
    return db.transaction(async (transaction) => {
      if (signals.length > 0) {
        await transaction
          .insert(signal)
          .values(signals.map((entry) => NewSignalSchema.parse(entry)));
      }

      const rows = await transaction
        .insert(assessment)
        .values(NewAssessmentSchema.parse(input))
        .returning();
      return parseRow(AssessmentSchema, rows[0], "assessment create");
    });
  },

  async byTarget(targetId: Assessment["targetId"]) {
    const rows = await db
      .select()
      .from(assessment)
      .where(eq(assessment.targetId, targetId))
      .orderBy(asc(assessment.createdAt));
    return parseRows(AssessmentSchema, rows);
  },
};
