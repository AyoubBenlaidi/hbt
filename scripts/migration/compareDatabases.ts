/**
 * Compares the application tables of two Postgres databases (Supabase → Neon):
 * columns, row counts and a checksum of every row.
 *
 * Rows are serialized with to_jsonb (sorted keys, so independent of column
 * order) and ordered by id. Timestamps are rendered in UTC: run on a single
 * connection (pg Client or PGlite), not a Pool.
 */

export interface Queryable {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Parents first: the order to copy data in */
export const APP_TABLES = [
  "users",
  "user_profiles",
  "households",
  "household_members",
  "household_join_requests",
  "expenses",
  "expense_payers",
  "expense_splits",
  "monthly_reports",
] as const;

/**
 * Columns that only exist in the target (Neon) by design: compared rows
 * exclude them. users.email_verified / image are Better Auth fields, filled
 * by the auth import after the data copy.
 */
export const TARGET_ONLY_COLUMNS: Record<string, string[]> = {
  users: ["email_verified", "image"],
};

export interface TableSnapshot {
  columns: string[];
  rows: number;
  checksum: string;
}

export interface TableComparison {
  table: string;
  source: TableSnapshot | null;
  target: TableSnapshot | null;
  ok: boolean;
  issues: string[];
}

async function snapshotTable(
  db: Queryable,
  table: string,
  excludedColumns: string[]
): Promise<TableSnapshot | null> {
  const columns = (
    await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY column_name`,
      [table]
    )
  )
    .rows.map((r) => r.column_name)
    .filter((c) => !excludedColumns.includes(c));

  if (columns.length === 0) return null;

  const { rows } = await db.query<{ rows: number; checksum: string | null }>(
    `SELECT count(*)::int AS rows,
            md5(string_agg((to_jsonb(t) - $1::text[])::text, E'\\n' ORDER BY t.id::text)) AS checksum
     FROM "${table}" t`,
    [excludedColumns]
  );

  return { columns, rows: rows[0].rows, checksum: rows[0].checksum ?? "" };
}

export async function compareDatabases(
  source: Queryable,
  target: Queryable,
  tables: readonly string[] = APP_TABLES,
  targetOnlyColumns: Record<string, string[]> = TARGET_ONLY_COLUMNS
): Promise<TableComparison[]> {
  await source.query("SET TIME ZONE 'UTC'");
  await target.query("SET TIME ZONE 'UTC'");

  const results: TableComparison[] = [];

  for (const table of tables) {
    const excluded = targetOnlyColumns[table] ?? [];
    const [s, t] = [await snapshotTable(source, table, excluded), await snapshotTable(target, table, excluded)];
    const issues: string[] = [];

    if (!s) issues.push("missing in source");
    if (!t) issues.push("missing in target");

    if (s && t) {
      const onlySource = s.columns.filter((c) => !t.columns.includes(c));
      const onlyTarget = t.columns.filter((c) => !s.columns.includes(c));
      if (onlySource.length) issues.push(`columns only in source: ${onlySource.join(", ")}`);
      if (onlyTarget.length) issues.push(`columns only in target: ${onlyTarget.join(", ")}`);
      if (s.rows !== t.rows) issues.push(`row count ${s.rows} ≠ ${t.rows}`);
      else if (s.checksum !== t.checksum) issues.push("same row count but different content");
    }

    results.push({ table, source: s, target: t, ok: issues.length === 0, issues });
  }

  return results;
}
