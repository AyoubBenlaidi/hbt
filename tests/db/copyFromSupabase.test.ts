import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { copyFromSupabase, verifyCopy } from "../../scripts/migration/copyFromSupabase";
import { createTestDb } from "../helpers/db";

/**
 * Supabase REST rows (as the API returns them) land identically in the target
 */

const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  household: "22222222-2222-4222-8222-222222222222",
  member: "33333333-3333-4333-8333-333333333333",
  expense: "44444444-4444-4444-8444-444444444444",
};

function fakeSupabase(tables: Record<string, Record<string, unknown>[]>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    const table = u.pathname.split("/").pop()!;
    const offset = Number(u.searchParams.get("offset"));
    const limit = Number(u.searchParams.get("limit"));
    return new Response(JSON.stringify((tables[table] ?? []).slice(offset, offset + limit)));
  }) as typeof fetch;
}

const supabaseRows = () => ({
  users: [{ id: ids.alice, email: "alice@example.com", display_name: "Alice", created_at: "2026-04-01T10:00:00.123456", updated_at: "2026-04-01T10:00:00.123456" }],
  households: [{ id: ids.household, name: "B☀️", created_by_user_id: ids.alice, created_at: "2026-04-01T10:00:00", updated_at: "2026-04-01T10:00:00", join_code: "ABC234", join_code_enabled: true, join_code_updated_at: "2026-04-01T10:00:00+00:00" }],
  household_members: [{ id: ids.member, household_id: ids.household, user_id: ids.alice, role: "owner", status: "active", joined_at: "2026-04-01T10:00:00", left_at: null, created_at: "2026-04-01T10:00:00", updated_at: "2026-04-01T10:00:00" }],
  expenses: [{ id: ids.expense, household_id: ids.household, created_by_user_id: ids.alice, description: "Courses", expense_date: "2026-10-02", currency: "EUR", expense_kind: "expense", notes: null, created_at: "2026-10-02T08:00:00.5", updated_at: "2026-10-02T08:00:00.5", deleted_at: null, amount: 54.59 }],
  expense_payers: [{ id: "55555555-5555-4555-8555-555555555555", expense_id: ids.expense, member_id: ids.member, amount: 54.59, created_at: "2026-10-02T08:00:00" }],
  expense_splits: [{ id: "66666666-6666-4666-8666-666666666666", expense_id: ids.expense, member_id: ids.member, amount: 54.59, created_at: "2026-10-02T08:00:00" }],
  monthly_reports: [{ id: "77777777-7777-4777-8777-777777777777", household_id: ids.household, month: "2026-10", sent_at: "2026-11-01T06:03:42.94648+00:00" }],
});

let client: PGlite;

beforeEach(async () => {
  ({ client } = await createTestDb());
  await client.query("SET TIME ZONE 'UTC'");
});
afterEach(async () => {
  await client.close();
});

describe("copyFromSupabase", () => {
  it("copies every table and verifies each row", async () => {
    const checks = await copyFromSupabase({ url: "https://x.supabase.co", secretKey: "k", fetchFn: fakeSupabase(supabaseRows()) }, client);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(checks.find((c) => c.table === "expenses")).toMatchObject({ source: 1, target: 1 });

    const { rows } = await client.query<{ amount: string; email_verified: boolean }>(
      "SELECT e.amount, u.email_verified FROM expenses e JOIN users u ON u.id = e.created_by_user_id"
    );
    expect(rows[0]).toEqual({ amount: "54.59", email_verified: false });
  });

  it("refuses a target with data unless --replace, then replaces it", async () => {
    const source = { url: "https://x.supabase.co", secretKey: "k", fetchFn: fakeSupabase(supabaseRows()) };
    await copyFromSupabase(source, client);
    await expect(copyFromSupabase(source, client)).rejects.toThrow("--replace");
    const checks = await copyFromSupabase(source, client, { replace: true });
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("reports a row that differs after the copy", async () => {
    const rows = supabaseRows();
    await copyFromSupabase({ url: "https://x.supabase.co", secretKey: "k", fetchFn: fakeSupabase(rows) }, client);
    await client.query("UPDATE expenses SET description = 'changed'");
    await client.query("DELETE FROM monthly_reports");

    const checks = await verifyCopy(rows, client);
    expect(checks.find((c) => c.table === "expenses")).toMatchObject({ ok: false, firstDifference: `id ${ids.expense}` });
    expect(checks.find((c) => c.table === "monthly_reports")).toMatchObject({ ok: false, source: 1, target: 0 });
    expect(checks.filter((c) => !c.ok)).toHaveLength(2);
  });
});
