import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

/**
 * Direct Postgres access (Drizzle), server-side only.
 * Target of the Supabase → Neon migration: DATABASE_URL points to the
 * Neon pooled connection string (…-pooler…/db?sslmode=require).
 */

export type Database = NodePgDatabase<typeof schema>;

// Reused across hot reloads in dev and across invocations of a warm serverless instance
const globalForDb = globalThis as unknown as { _hbtDb?: Database };

export function getDb(): Database {
  if (!globalForDb._hbtDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const pool = new Pool({ connectionString, max: 5 });
    globalForDb._hbtDb = drizzle(pool, { schema });
  }

  return globalForDb._hbtDb;
}

export default getDb;
