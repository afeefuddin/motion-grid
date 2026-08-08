import { asc, eq } from "drizzle-orm";
import type { Policy } from "../../contracts";
import { NewPolicySchema, PolicySchema } from "../../contracts";
import { db } from "../client";
import { policy } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewPolicy } from "./types";

export const policyRepo = {
  async create(input: NewPolicy) {
    const rows = await db
      .insert(policy)
      .values(NewPolicySchema.parse(input))
      .returning();
    return parseRow(PolicySchema, rows[0], "policy create");
  },

  async byWorkspace(workspaceId: Policy["workspaceId"]) {
    const rows = await db
      .select()
      .from(policy)
      .where(eq(policy.workspaceId, workspaceId))
      .orderBy(asc(policy.createdAt));
    return parseRows(PolicySchema, rows);
  },
};
