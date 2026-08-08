import { eq } from "drizzle-orm";
import { NewWorkspaceSchema, WorkspaceSchema } from "../../contracts";
import { db } from "../client";
import { workspace } from "../schema";
import { parseOptionalRow, parseRow } from "./parse";
import type { NewWorkspace } from "./types";

export const workspaceRepo = {
  async get(id: string) {
    const rows = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, id))
      .limit(1);
    return parseOptionalRow(WorkspaceSchema, rows[0]);
  },

  async seed(input: NewWorkspace) {
    const value = NewWorkspaceSchema.parse(input);
    const rows = await db
      .insert(workspace)
      .values(value)
      .onConflictDoUpdate({
        target: workspace.id,
        set: { name: value.name, updatedAt: new Date() },
      })
      .returning();
    return parseRow(WorkspaceSchema, rows[0], "workspace seed");
  },
};
