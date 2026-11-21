/**
 * Usage:
 *   DATABASE_URL_UNPOOLED=<neon direct url> npm run migration:import-auth -- supabase-auth-users.json
 *
 * The JSON file comes from this query in the Supabase SQL editor (copy the single cell):
 *   select json_agg(json_build_object(
 *     'id', id, 'email', email,
 *     'encrypted_password', encrypted_password,
 *     'email_confirmed_at', email_confirmed_at
 *   )) from auth.users;
 * It holds password hashes: delete it once imported.
 */
import fs from "node:fs";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { importSupabaseAuthUsers, type SupabaseAuthUser } from "./importSupabaseAuth";

async function main() {
  const [file] = process.argv.slice(2);
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!file || !connectionString) {
    throw new Error("Usage: DATABASE_URL_UNPOOLED=… import-supabase-auth <users.json>");
  }

  const authUsers = JSON.parse(fs.readFileSync(file, "utf8")) as SupabaseAuthUser[];
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const report = await importSupabaseAuthUsers(drizzle(client, { schema }), authUsers);
    console.log(`Imported:          ${report.imported.length}`);
    console.log(`Already imported:  ${report.alreadyImported.length}`);
    console.log(`Email updated:     ${report.emailUpdated.length}`);
    if (report.withoutPassword.length) console.log(`Without password:  ${report.withoutPassword.join(", ")}`);
    if (report.missingUser.length) console.log(`Missing users row: ${report.missingUser.join(", ")}`);
    process.exitCode = report.missingUser.length > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
