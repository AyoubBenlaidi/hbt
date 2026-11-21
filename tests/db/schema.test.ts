import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "@/db/schema";
import { createTestDb, type TestDb } from "../helpers/db";
import { addMember, createExpense, createHousehold, createUser } from "../helpers/factories";

/**
 * The Drizzle migrations must rebuild the exact schema the app relies on in
 * Supabase (tables, constraints, cascades): this is what Neon will run.
 */

let db: TestDb;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

const tableNames = async () =>
  (
    await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
  ).rows.map((r) => r.table_name);

describe("migrations", () => {
  it("create every table used by the app", async () => {
    expect(await tableNames()).toEqual([
      "accounts",
      "expense_payers",
      "expense_splits",
      "expenses",
      "household_join_requests",
      "household_members",
      "households",
      "monthly_reports",
      "sessions",
      "user_profiles",
      "users",
      "verifications",
    ]);
  });
});

describe("constraints", () => {
  it("reject a duplicate email", async () => {
    await createUser(db, { email: "dup@example.com" });
    await expect(createUser(db, { email: "dup@example.com" })).rejects.toThrow();
  });

  it("reject a duplicate join code", async () => {
    const owner = await createUser(db);
    const { household } = await createHousehold(db, owner);
    await expect(
      db.insert(schema.households).values({ name: "Autre", createdByUserId: owner.id, joinCode: household.joinCode })
    ).rejects.toThrow();
  });

  it("reject a non-positive payer amount and a duplicate split", async () => {
    const owner = await createUser(db);
    const { household, ownerMember } = await createHousehold(db, owner);
    const params = { household, createdBy: owner, amount: "10" };

    await expect(
      createExpense(db, { ...params, payers: [{ member: ownerMember, amount: "0" }], splits: [] })
    ).rejects.toThrow();
    await expect(
      createExpense(db, {
        ...params,
        payers: [{ member: ownerMember, amount: "10" }],
        splits: [
          { member: ownerMember, amount: "5" },
          { member: ownerMember, amount: "5" },
        ],
      })
    ).rejects.toThrow();
  });

  it("reject an unknown expense kind", async () => {
    const owner = await createUser(db);
    const { household } = await createHousehold(db, owner);
    await expect(
      db.insert(schema.expenses).values({
        householdId: household.id,
        createdByUserId: owner.id,
        description: "x",
        expenseDate: "2026-10-01",
        expenseKind: "gift",
      })
    ).rejects.toThrow();
  });

  it("allow a single pending join request per user and household", async () => {
    const owner = await createUser(db);
    const requester = await createUser(db);
    const { household } = await createHousehold(db, owner);
    const request = { householdId: household.id, requesterUserId: requester.id, codeUsed: household.joinCode };

    await db.insert(schema.householdJoinRequests).values(request);
    await expect(db.insert(schema.householdJoinRequests).values(request)).rejects.toThrow();
    // A reviewed request no longer blocks a new one
    await db.update(schema.householdJoinRequests).set({ status: "rejected" });
    await db.insert(schema.householdJoinRequests).values(request);
  });

  it("allow a single monthly report per household and month", async () => {
    const owner = await createUser(db);
    const { household } = await createHousehold(db, owner);
    await db.insert(schema.monthlyReports).values({ householdId: household.id, month: "2026-10" });
    await expect(
      db.insert(schema.monthlyReports).values({ householdId: household.id, month: "2026-10" })
    ).rejects.toThrow();
  });

  it("require a user for a profile and keep updated_at current", async () => {
    await expect(
      db.insert(schema.userProfiles).values({ id: "00000000-0000-0000-0000-000000000000", pseudo: "ghost" })
    ).rejects.toThrow();

    const user = await createUser(db);
    const [profile] = await db.insert(schema.userProfiles).values({ id: user.id, pseudo: "alice" }).returning();
    await new Promise((r) => setTimeout(r, 10));
    const [updated] = await db
      .update(schema.userProfiles)
      .set({ description: "hello" })
      .where(eq(schema.userProfiles.id, user.id))
      .returning();
    expect(updated.updatedAt!.getTime()).toBeGreaterThan(profile.updatedAt!.getTime());
  });
});

describe("cascades", () => {
  it("deleting a household removes members, expenses, payers, splits and reports", async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    const { household, ownerMember } = await createHousehold(db, owner);
    const otherMember = await addMember(db, household, other);
    await createExpense(db, {
      household,
      createdBy: owner,
      amount: "20",
      payers: [{ member: ownerMember, amount: "20" }],
      splits: [
        { member: ownerMember, amount: "10" },
        { member: otherMember, amount: "10" },
      ],
    });
    await db.insert(schema.monthlyReports).values({ householdId: household.id, month: "2026-09" });

    await db.delete(schema.households).where(eq(schema.households.id, household.id));

    const count = async (table: string) =>
      Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
    const memberIds = [ownerMember.id, otherMember.id];
    expect(
      (await client.query(`SELECT 1 FROM household_members WHERE id = ANY($1)`, [memberIds])).rows
    ).toHaveLength(0);
    expect(
      (await client.query(`SELECT 1 FROM expenses WHERE household_id = $1`, [household.id])).rows
    ).toHaveLength(0);
    expect(
      (await client.query(`SELECT 1 FROM expense_payers WHERE member_id = ANY($1)`, [memberIds])).rows
    ).toHaveLength(0);
    expect(
      (await client.query(`SELECT 1 FROM monthly_reports WHERE household_id = $1`, [household.id])).rows
    ).toHaveLength(0);
    expect(await count("users")).toBeGreaterThan(0);
  });
});
