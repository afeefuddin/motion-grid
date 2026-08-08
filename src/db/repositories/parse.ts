import type { ZodType } from "zod";

/** Parses one required result row against its public entity contract. */
export const parseRow = <T>(
  schema: ZodType<T>,
  row: unknown,
  operation: string,
): T => {
  if (row === undefined) {
    throw new Error(`${operation} did not return a row`);
  }

  return schema.parse(row);
};

/** Parses one optional result row against its public entity contract. */
export const parseOptionalRow = <T>(
  schema: ZodType<T>,
  row: unknown,
): T | null => (row === undefined ? null : schema.parse(row));

/** Parses result rows against their public entity contract. */
export const parseRows = <T>(schema: ZodType<T>, rows: unknown[]): T[] =>
  rows.map((row) => schema.parse(row));
