// This file is deprecated - using Supabase client directly in Server Actions instead
// Keeping for reference in case we need direct database connections in the future

/*
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const client = postgres(connectionString);
    db = drizzle(client, { schema });
  }

  return db;
}

export default getDb;
*/
