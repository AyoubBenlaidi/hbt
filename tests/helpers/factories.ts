import { randomUUID } from "node:crypto";
import * as schema from "@/db/schema";
import type { TestDb } from "./db";

/**
 * Minimal row builders for database tests
 */

let counter = 0;
const next = () => ++counter;

export async function createUser(db: TestDb, overrides: Partial<schema.InsertUser> = {}) {
  const n = next();
  const [user] = await db
    .insert(schema.users)
    .values({ id: randomUUID(), email: `user${n}@example.com`, displayName: `User ${n}`, ...overrides })
    .returning();
  return user;
}

/** Household with its owner as active member */
export async function createHousehold(db: TestDb, owner: schema.User, name = "Foyer") {
  const [household] = await db
    .insert(schema.households)
    .values({ name, createdByUserId: owner.id, joinCode: `C${String(next()).padStart(5, "0")}` })
    .returning();
  const ownerMember = await addMember(db, household, owner, "owner");
  return { household, ownerMember };
}

export async function addMember(
  db: TestDb,
  household: schema.Household,
  user: schema.User,
  role = "member"
) {
  const [member] = await db
    .insert(schema.householdMembers)
    .values({ householdId: household.id, userId: user.id, role, status: "active" })
    .returning();
  return member;
}

/** Expense paid and split as given (amounts as strings, like numeric columns) */
export async function createExpense(
  db: TestDb,
  params: {
    household: schema.Household;
    createdBy: schema.User;
    amount: string;
    payers: { member: schema.HouseholdMember; amount: string }[];
    splits: { member: schema.HouseholdMember; amount: string }[];
    description?: string;
    expenseDate?: string;
  }
) {
  const [expense] = await db
    .insert(schema.expenses)
    .values({
      householdId: params.household.id,
      createdByUserId: params.createdBy.id,
      description: params.description ?? "Dépense",
      amount: params.amount,
      expenseDate: params.expenseDate ?? "2026-10-15",
      expenseKind: "expense",
    })
    .returning();

  await db.insert(schema.expensePayers).values(
    params.payers.map((p) => ({ expenseId: expense.id, memberId: p.member.id, amount: p.amount }))
  );
  await db.insert(schema.expenseSplits).values(
    params.splits.map((s) => ({ expenseId: expense.id, memberId: s.member.id, amount: s.amount }))
  );

  return expense;
}
