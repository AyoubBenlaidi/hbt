/**
 * Copies the application tables from Supabase to a fresh database (Neon),
 * reading Supabase through its REST API (secret key, read-only) and writing
 * with plain SQL, then checks every row.
 *
 * Works over HTTPS only: the target can be the Neon HTTP driver.
 */

import { APP_TABLES, TARGET_ONLY_COLUMNS, type Queryable } from "./compareDatabases";

export interface SupabaseSource {
  url: string;
  secretKey: string;
  fetchFn?: typeof fetch;
}

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;
const INSERT_BATCH = 500;

/** Every row of a table, ordered by id (paginated) */
export async function readSupabaseTable(source: SupabaseSource, table: string): Promise<Row[]> {
  const fetchFn = source.fetchFn ?? fetch;
  const rows: Row[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetchFn(
      `${source.url}/rest/v1/${table}?select=*&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { apikey: source.secretKey, Authorization: `Bearer ${source.secretKey}` } }
    );
    if (!response.ok) {
      throw new Error(`Supabase ${table}: HTTP ${response.status} ${await response.text()}`);
    }
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function targetColumns(target: Queryable, table: string): Promise<string[]> {
  const { rows } = await target.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

/** Inserts rows, letting Postgres cast the JSON values to the column types */
async function insertRows(target: Queryable, table: string, rows: Row[]) {
  if (rows.length === 0) return;
  const available = new Set(await targetColumns(target, table));
  const columns = Object.keys(rows[0]).filter((c) => available.has(c));
  const missing = Object.keys(rows[0]).filter((c) => !available.has(c));
  if (missing.length > 0) {
    throw new Error(`${table}: columns missing in the target: ${missing.join(", ")}`);
  }

  const list = columns.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    await target.query(
      `INSERT INTO "${table}" (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
      [JSON.stringify(batch)]
    );
  }
}

export interface TableCheck {
  table: string;
  source: number;
  target: number;
  ok: boolean;
  firstDifference?: string;
}

/**
 * Row as comparable text: sorted keys, JSON values as parsed (numeric 130.00
 * and 130 are the same number). Timestamps compare as text: both sides render
 * them in UTC (Supabase API, Neon default time zone).
 */
function canonical(row: Row, excluded: string[]): string {
  const keys = Object.keys(row)
    .filter((k) => !excluded.includes(k))
    .sort();
  return JSON.stringify(keys.map((k) => [k, row[k]]));
}

/** Compares Supabase rows with the target, table by table */
export async function verifyCopy(
  sourceRows: Record<string, Row[]>,
  target: Queryable
): Promise<TableCheck[]> {
  const checks: TableCheck[] = [];
  for (const table of APP_TABLES) {
    const excluded = TARGET_ONLY_COLUMNS[table] ?? [];
    const { rows } = await target.query<{ row: Row }>(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY t.id`);
    const targetById = new Map(rows.map(({ row }) => [String(row.id), canonical(row, excluded)]));
    const source = sourceRows[table] ?? [];

    const different = source.find((row) => targetById.get(String(row.id)) !== canonical(row, excluded));
    checks.push({
      table,
      source: source.length,
      target: rows.length,
      ok: !different && source.length === rows.length,
      firstDifference: different ? `id ${String(different.id)}` : undefined,
    });
  }
  return checks;
}

export interface CopyOptions {
  /** Empty the target tables first (rehearsals) */
  replace?: boolean;
}

export async function readSupabaseTables(source: SupabaseSource): Promise<Record<string, Row[]>> {
  const sourceRows: Record<string, Row[]> = {};
  for (const table of APP_TABLES) {
    sourceRows[table] = await readSupabaseTable(source, table);
  }
  return sourceRows;
}

export async function copyFromSupabase(source: SupabaseSource, target: Queryable, options: CopyOptions = {}) {
  const sourceRows = await readSupabaseTables(source);

  const { rows } = await target.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
  if (rows[0].n > 0) {
    if (!options.replace) throw new Error("The target already has users: use --replace to empty it first");
    // users cascades to every table that references it (auth tables included)
    await target.query(`TRUNCATE ${APP_TABLES.map((t) => `"${t}"`).join(", ")}, sessions, accounts, verifications CASCADE`);
  }

  for (const table of APP_TABLES) {
    await insertRows(target, table, sourceRows[table]);
  }

  return verifyCopy(sourceRows, target);
}
