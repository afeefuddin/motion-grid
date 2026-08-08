import { asc, eq } from "drizzle-orm";
import type { Contact } from "../../contracts";
import { ContactSchema, NewContactSchema } from "../../contracts";
import { db } from "../client";
import { contact } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewContact } from "./types";

export const contactRepo = {
  async create(input: NewContact) {
    const rows = await db
      .insert(contact)
      .values(NewContactSchema.parse(input))
      .returning();
    return parseRow(ContactSchema, rows[0], "contact create");
  },

  async byTarget(targetId: Contact["targetId"]) {
    const rows = await db
      .select()
      .from(contact)
      .where(eq(contact.targetId, targetId))
      .orderBy(asc(contact.createdAt));
    return parseRows(ContactSchema, rows);
  },
};
