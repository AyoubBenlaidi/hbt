import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/**
 * Database health check (Drizzle → DATABASE_URL).
 * Protected by CRON_SECRET: each call can wake the Neon compute.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/health/db
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const result = await getDb().execute<{ version: string; tables: number }>(sql`
      SELECT version() AS version,
             (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables
    `);
    const row = result.rows[0];
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      version: row.version.split(" on ")[0],
      publicTables: row.tables,
    });
  } catch (err) {
    console.error("Database health check failed", err);
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
