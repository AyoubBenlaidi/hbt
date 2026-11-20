/**
 * Usage:
 *   SOURCE_DATABASE_URL=<supabase> TARGET_DATABASE_URL=<neon> npm run migration:compare
 * Exits with code 1 when any table differs.
 */
import { Client } from "pg";
import { compareDatabases } from "./compareDatabases";

async function main() {
  const { SOURCE_DATABASE_URL, TARGET_DATABASE_URL } = process.env;
  if (!SOURCE_DATABASE_URL || !TARGET_DATABASE_URL) {
    throw new Error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL");
  }

  const source = new Client({ connectionString: SOURCE_DATABASE_URL });
  const target = new Client({ connectionString: TARGET_DATABASE_URL });
  await Promise.all([source.connect(), target.connect()]);

  try {
    const results = await compareDatabases(source, target);
    for (const r of results) {
      const counts = `${r.source?.rows ?? "-"} → ${r.target?.rows ?? "-"}`;
      console.log(`${r.ok ? "✓" : "✗"} ${r.table.padEnd(24)} ${counts.padEnd(14)} ${r.issues.join("; ")}`);
    }
    const failed = results.filter((r) => !r.ok).length;
    console.log(failed === 0 ? "\nAll tables match." : `\n${failed} table(s) differ.`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
