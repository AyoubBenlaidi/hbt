import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

/**
 * In-memory Postgres (PGlite) with every Drizzle migration applied:
 * the same schema a fresh Neon database gets.
 */

export type TestDb = PgliteDatabase<typeof schema>;

export async function createTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../src/db/migrations") });
  return { db, client };
}
