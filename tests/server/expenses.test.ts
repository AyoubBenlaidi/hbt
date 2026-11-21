import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { AccessError } from "@/server/data/common";
import * as expenses from "@/server/data/expenses";
import { getDashboard } from "@/server/data/dashboard";
import * as profiles from "@/server/data/profiles";
import * as households from "@/server/data/households";
import { createTestDb, type TestDb } from "../helpers/db";
import { addMember, createHousehold, createUser } from "../helpers/factories";

let db: TestDb;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});
afterAll(async () => {
  await client.close();
});

async function setup() {
  const alice = await createUser(db, { displayName: "Alice" });
  const bob = await createUser(db, { displayName: "Bob" });
  const stranger = await createUser(db);
  const { household, ownerMember: a } = await createHousehold(db, alice);
  const b = await addMember(db, household, bob);
  return { alice, bob, stranger, household, a, b };
}

const input = (payers: string[], splits: string[], overrides: Partial<expenses.ExpenseInput> = {}): expenses.ExpenseInput => ({
  description: "Courses",
  amount: "100",
  expenseDate: "2026-11-02",
  payerMemberIds: payers,
  splitMemberIds: splits,
  ...overrides,
});

describe("expenses", () => {
  it("create splits equally (2 decimals) and lists with the Supabase-like shape", async () => {
    const { alice, household, a, b } = await setup();
    await expenses.createExpense(db, alice.id, household.id, input([a.id], [a.id, b.id], { amount: "10", notes: "bio" }));

    const [listed] = await expenses.listExpenses(db, alice.id, household.id);
    expect(listed).toMatchObject({
      description: "Courses",
      amount: 10,
      currency: "EUR",
      expense_date: "2026-11-02",
      expense_kind: "expense",
      notes: "bio",
      created_by_user_id: alice.id,
      household_id: household.id,
    });
    expect(listed.expense_payers).toEqual([
      { amount: 10, household_members: { id: a.id, user_id: alice.id, status: "active", users: { display_name: "Alice" } } },
    ]);
    expect(listed.expense_splits.map((s) => s.amount)).toEqual([5, 5]);
  });

  it("rounds a three-way split to the cent, like before", async () => {
    const { alice, household, a, b } = await setup();
    const carol = await createUser(db);
    const c = await addMember(db, household, carol);
    const { expenseId } = await expenses.createExpense(db, alice.id, household.id, input([a.id], [a.id, b.id, c.id]));
    const expense = await expenses.getExpense(db, alice.id, expenseId);
    expect(expense!.expense_splits.map((s) => s.amount)).toEqual([33.33, 33.33, 33.33]);
  });

  it("validates payers, beneficiaries and membership", async () => {
    const { alice, stranger, household, a } = await setup();
    const other = await createHousehold(db, stranger);
    await expect(expenses.createExpense(db, alice.id, household.id, input([], [a.id]))).rejects.toThrow("At least one payer is required");
    await expect(expenses.createExpense(db, alice.id, household.id, input([a.id], []))).rejects.toThrow("At least one participant");
    // A member of another household cannot be used
    await expect(
      expenses.createExpense(db, alice.id, household.id, input([other.ownerMember.id], [a.id]))
    ).rejects.toBeInstanceOf(AccessError);
    // A stranger cannot add to the household
    await expect(expenses.createExpense(db, stranger.id, household.id, input([a.id], [a.id]))).rejects.toBeInstanceOf(AccessError);
  });

  it("update replaces fields, payers and splits", async () => {
    const { alice, bob, household, a, b } = await setup();
    const { expenseId } = await expenses.createExpense(db, alice.id, household.id, input([a.id], [a.id, b.id]));
    await expenses.updateExpense(db, bob.id, expenseId, input([b.id], [a.id], { description: "Resto", amount: "42.5", currency: "EUR", notes: "" }));

    const updated = await expenses.getExpense(db, alice.id, expenseId);
    expect(updated).toMatchObject({ description: "Resto", amount: 42.5 });
    expect(updated!.expense_payers.map((p) => [p.household_members.id, p.amount])).toEqual([[b.id, 42.5]]);
    expect(updated!.expense_splits.map((s) => [s.household_members.id, s.amount])).toEqual([[a.id, 42.5]]);
  });

  it("soft delete removes it from the list; strangers can neither read nor delete", async () => {
    const { alice, stranger, household, a } = await setup();
    const { expenseId } = await expenses.createExpense(db, alice.id, household.id, input([a.id], [a.id]));

    expect(await expenses.getExpense(db, stranger.id, expenseId)).toBeNull();
    await expect(expenses.listExpenses(db, stranger.id, household.id)).rejects.toBeInstanceOf(AccessError);
    await expect(expenses.deleteExpense(db, stranger.id, expenseId)).rejects.toBeInstanceOf(AccessError);
    await expect(expenses.updateExpense(db, stranger.id, expenseId, input([a.id], [a.id]))).rejects.toBeInstanceOf(AccessError);

    await expenses.deleteExpense(db, alice.id, expenseId);
    expect(await expenses.listExpenses(db, alice.id, household.id)).toEqual([]);
  });

  it("lists active members for the pickers", async () => {
    const { alice, household, a, b } = await setup();
    const members = await expenses.listActiveMembers(db, alice.id, household.id);
    expect(members.map((m) => m.id)).toEqual([a.id, b.id]);
    expect(members[1].users).toMatchObject({ display_name: "Bob" });
  });
});

describe("dashboard", () => {
  it("returns my paid and owed lines and the household total", async () => {
    const { alice, bob, household, a, b } = await setup();
    await expenses.createExpense(db, alice.id, household.id, input([a.id], [a.id, b.id], { expenseDate: "2026-10-01" }));
    await expenses.createExpense(db, bob.id, household.id, input([b.id], [b.id], { amount: "30", expenseDate: "2026-11-01" }));

    const [dash] = await getDashboard(db, alice.id);
    expect(dash).toMatchObject({ householdId: household.id, householdName: household.name, totalSpentAllTime: 130 });
    expect(dash.transactions.map((t) => [t.type, t.amount, t.expenseAmount, t.date])).toEqual([
      ["paid", 100, 100, "2026-10-01"],
      ["owed", 50, 100, "2026-10-01"],
    ]);
  });
});

describe("profiles", () => {
  it("creates my default profile on first read and updates it", async () => {
    const { alice } = await setup();
    const created = await profiles.getProfile(db, alice.id, alice.id);
    expect(created).toMatchObject({ id: alice.id, pseudo: `User${alice.id.slice(0, 8).toUpperCase()}` });
    expect((await profiles.getProfile(db, alice.id, alice.id))!.pseudo).toBe(created!.pseudo);

    const updated = await profiles.updateMyProfile(db, alice.id, { pseudo: "Alice", description: "", avatarColor: "#3E5C76" });
    expect(updated).toMatchObject({ pseudo: "Alice", description: null, avatar_color: "#3E5C76" });
  });

  it("is visible to housemates and join-request owners, not to strangers", async () => {
    const { alice, bob, stranger, household } = await setup();
    await profiles.getProfile(db, bob.id, bob.id);
    expect(await profiles.getProfile(db, alice.id, bob.id)).not.toBeNull();
    expect(await profiles.getProfile(db, stranger.id, bob.id)).toBeNull();
    // Strangers' own profiles are not created by others
    expect(await profiles.getProfile(db, alice.id, stranger.id)).toBeNull();

    await profiles.getProfile(db, stranger.id, stranger.id);
    await households.requestToJoin(db, stranger.id, household.joinCode);
    expect(await profiles.getProfile(db, alice.id, stranger.id)).not.toBeNull();
  });

  it("refuses a pseudo taken by someone else", async () => {
    const { alice, bob } = await setup();
    await profiles.getProfile(db, alice.id, alice.id);
    await profiles.getProfile(db, bob.id, bob.id);
    await profiles.updateMyProfile(db, alice.id, { pseudo: "Taken", description: "", avatarColor: "#4A7C59" });
    await expect(
      profiles.updateMyProfile(db, bob.id, { pseudo: "Taken", description: "", avatarColor: "#4A7C59" })
    ).rejects.toThrow("This pseudo is already taken");
  });
});
