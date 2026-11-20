/**
 * Applies the Drizzle migrations to a Neon database over HTTPS, for machines
 * without access to the Postgres port (same result as `npm run db:migrate`).
 *
 *   TARGET_DATABASE_URL=<neon direct url> npm run db:migrate:http
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.TARGET_DATABASE_URL;
  if (!url) throw new Error("Set TARGET_DATABASE_URL");
  const sql = neon(url);
  await migrate(drizzle(sql), { migrationsFolder: "src/db/migrations" });
  const [{ tables }] = (await sql`
    SELECT string_agg(table_name, ', ' ORDER BY table_name) AS tables
    FROM information_schema.tables WHERE table_schema = 'public'
  `) as { tables: string }[];
  console.log(`✓ Migrations applied. Tables: ${tables}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
