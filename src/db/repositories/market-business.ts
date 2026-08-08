import { asc, eq, sql } from "drizzle-orm";
import type { Business } from "../../sim/schema";
import { BusinessSchema } from "../../sim/schema";
import { db } from "../client";
import { marketBusiness } from "../schema";

export const marketBusinessRepo = {
  /** Upserts complete source artifacts so every downstream lookup shares one record. */
  async upsert(
    businesses: readonly Business[],
    options: { readonly geography: string; readonly provenance: string },
  ) {
    if (businesses.length === 0) {
      return;
    }
    const values = businesses.map((input) => {
      const business = BusinessSchema.parse(input);
      return {
        externalRef: business.id,
        name: business.name,
        geography: options.geography,
        locality: business.locality,
        category: business.category,
        provenance: options.provenance,
        artifact: business,
      };
    });
    await db
      .insert(marketBusiness)
      .values(values)
      .onConflictDoUpdate({
        target: marketBusiness.externalRef,
        set: {
          name: sql`excluded.name`,
          geography: sql`excluded.geography`,
          locality: sql`excluded.locality`,
          category: sql`excluded.category`,
          provenance: sql`excluded.provenance`,
          artifact: sql`excluded.artifact`,
          updatedAt: new Date(),
        },
      });
  },

  /** Returns the complete catalog; semantic filtering belongs to Location Finder. */
  async all(): Promise<Business[]> {
    const rows = await db
      .select({ artifact: marketBusiness.artifact })
      .from(marketBusiness)
      .orderBy(asc(marketBusiness.name));
    return rows.map(({ artifact }) => BusinessSchema.parse(artifact));
  },

  async find(externalRef: string): Promise<Business | null> {
    const rows = await db
      .select({ artifact: marketBusiness.artifact })
      .from(marketBusiness)
      .where(eq(marketBusiness.externalRef, externalRef))
      .limit(1);
    return rows[0] === undefined
      ? null
      : BusinessSchema.parse(rows[0].artifact);
  },
};
