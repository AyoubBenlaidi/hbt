import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { compareDatabases } from "../../scripts/migration/compareDatabases";
import { createTestDb, type TestDb } from "../helpers/db";
import { addMember, createExpense, createHousehold, createUser } from "../helpers/factories";

/**
 * The tool that validates the Supabase → Neon data copy must catch any
 * difference: missing rows, altered values, schema drift.
 */

let source: { db: TestDb; client: PGlite };
let target: { db: TestDb; client: PGlite };

async function seed(db: TestDb) {
  const alice = await createUser(db, { id: "11111111-1111-1111-1111-111111111111", email: "alice@example.com" });
  const bob = await createUser(db, { id: "22222222-2222-2222-2222-222222222222", email: "bob@example.com" });
  const { household, ownerMember } = await createHousehold(db, alice);
  const bobMember = await addMember(db, household, bob);
  await createExpense(db, {
    household,
    createdBy: alice,
    amount: "130",
    payers: [{ member: ownerMember, amount: "130" }],
    splits: [
      { member: ownerMember, amount: "65" },
      { member: bobMember, amount: "65" },
    ],
  });
}

/** Copies every row of the app tables, like pg_dump --data-only | psql */
async function copyAll(from: PGlite, to: PGlite) {
  for (const table of [
    "users",
    "households",
    "household_members",
    "expenses",
    "expense_payers",
    "expense_splits",
  ]) {
    const { rows } = await from.query<{ row: unknown }>(`SELECT to_jsonb(t) AS row FROM ${table} t`);
    for (const { row } of rows) {
      await to.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table}, $1)`, [row]);
    }
  }
}

beforeEach(async () => {
  [source, target] = await Promise.all([createTestDb(), createTestDb()]);
  await seed(source.db);
  await copyAll(source.client, target.client);
});

afterEach(async () => {
  await Promise.all([source.client.close(), target.client.close()]);
});

describe("compareDatabases", () => {
  it("reports identical databases as matching", async () => {
    const results = await compareDatabases(source.client, target.client);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.find((r) => r.table === "expense_splits")?.source?.rows).toBe(2);
  });

  it("detects a missing row", async () => {
    await target.client.query("DELETE FROM expense_splits WHERE id = (SELECT id FROM expense_splits LIMIT 1)");
    const split = (await compareDatabases(source.client, target.client)).find((r) => r.table === "expense_splits")!;
    expect(split.ok).toBe(false);
    expect(split.issues).toContain("row count 2 ≠ 1");
  });

  it("detects an altered value with the same row count", async () => {
    await target.client.query("UPDATE expenses SET amount = 131");
    const expenses = (await compareDatabases(source.client, target.client)).find((r) => r.table === "expenses")!;
    expect(expenses.issues).toEqual(["same row count but different content"]);
  });

  it("detects schema drift", async () => {
    await source.client.query("ALTER TABLE users ADD COLUMN phone text");
    const users = (await compareDatabases(source.client, target.client)).find((r) => r.table === "users")!;
    expect(users.issues).toContain("columns only in source: phone");
  });

  it("is independent of the session time zone", async () => {
    await source.client.query("SET TIME ZONE 'Europe/Paris'");
    const results = await compareDatabases(source.client, target.client);
    expect(results.every((r) => r.ok)).toBe(true);
  });
});
