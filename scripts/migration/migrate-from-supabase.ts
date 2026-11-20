/**
 * Copies Supabase → target database, checks every row, then imports the
 * Supabase Auth accounts (same ids, same passwords).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… \
 *   TARGET_DATABASE_URL=<neon direct url> [NEON_HTTP=1] \
 *   npm run migration:from-supabase -- [--replace] [--skip-auth] [--verify-only]
 *
 * NEON_HTTP=1 talks to Neon over HTTPS (no Postgres port needed).
 * --verify-only compares Supabase with the target without writing anything
 * (after the switch: writes made on the old version during the deployment).
 * Account hashes come from the export_auth_users() SQL function (see the
 * migration guide); it must exist in Supabase unless --skip-auth.
 * Exits with code 1 when anything does not match.
 */
import { Client } from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import type { Db } from "@/server/data/common";
import type { Queryable } from "./compareDatabases";
import { copyFromSupabase, readSupabaseTables, verifyCopy, type SupabaseSource } from "./copyFromSupabase";
import { importSupabaseAuthUsers, type SupabaseAuthUser } from "./importSupabaseAuth";

async function fetchAuthUsers(source: SupabaseSource): Promise<SupabaseAuthUser[]> {
  const response = await fetch(`${source.url}/rest/v1/rpc/export_auth_users`, {
    method: "POST",
    headers: { apikey: source.secretKey, Authorization: `Bearer ${source.secretKey}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(`export_auth_users(): HTTP ${response.status} ${await response.text()}`);
  return ((await response.json()) as SupabaseAuthUser[] | null) ?? [];
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, TARGET_DATABASE_URL, NEON_HTTP } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !TARGET_DATABASE_URL) {
    throw new Error("Set SUPABASE_URL, SUPABASE_SECRET_KEY and TARGET_DATABASE_URL");
  }
  const args = process.argv.slice(2);
  const source: SupabaseSource = { url: SUPABASE_URL.replace(/\/$/, ""), secretKey: SUPABASE_SECRET_KEY };

  let target: Queryable;
  let db: Db;
  let close = async () => {};
  if (NEON_HTTP === "1") {
    const sql = neon(TARGET_DATABASE_URL, { fullResults: true });
    target = { query: async (text, params) => sql.query(text, params as unknown[]) as never };
    db = drizzleNeon(neon(TARGET_DATABASE_URL), { schema }) as unknown as Db;
  } else {
    const client = new Client({ connectionString: TARGET_DATABASE_URL });
    await client.connect();
    target = client;
    db = drizzlePg(client, { schema }) as unknown as Db;
    close = () => client.end();
  }

  try {
    const verifyOnly = args.includes("--verify-only");
    const checks = verifyOnly
      ? await verifyCopy(await readSupabaseTables(source), target)
      : await copyFromSupabase(source, target, { replace: args.includes("--replace") });
    for (const c of checks) {
      console.log(`${c.ok ? "✓" : "✗"} ${c.table.padEnd(24)} ${String(c.source).padStart(4)} → ${String(c.target).padEnd(4)} ${c.firstDifference ?? ""}`);
    }
    let failed = checks.some((c) => !c.ok);

    if (!verifyOnly && !args.includes("--skip-auth")) {
      const report = await importSupabaseAuthUsers(db, await fetchAuthUsers(source));
      console.log(
        `\nAccounts: ${report.imported.length} imported, ${report.alreadyImported.length} already there, ` +
          `${report.emailUpdated.length} email updated`
      );
      if (report.withoutPassword.length) console.log(`Without password: ${report.withoutPassword.join(", ")}`);
      if (report.missingUser.length) {
        console.log(`Missing users row: ${report.missingUser.join(", ")}`);
        failed = true;
      }
    }

    console.log(failed ? "\n✗ Migration check FAILED" : verifyOnly ? "\n✓ Target matches Supabase" : "\n✓ Data copied and verified");
    process.exitCode = failed ? 1 : 0;
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
