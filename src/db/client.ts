import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize the database client");
}

const createDatabase = () => {
  const queryClient = postgres(databaseUrl);

  return {
    queryClient,
    db: drizzle(queryClient, { schema }),
  };
};

declare global {
  var motionGridDatabase: ReturnType<typeof createDatabase> | undefined;
}

const database = globalThis.motionGridDatabase ?? createDatabase();
globalThis.motionGridDatabase = database;

export const db = database.db;

/** Closes the shared connection pool, primarily for one-shot processes and tests. */
export const closeDatabase = () => database.queryClient.end();
