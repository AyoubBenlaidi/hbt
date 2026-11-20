import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import { AccessError, UserError, isUuid, iso, num, requireMember, type Db } from "./common";

/**
 * Expenses with their payers and splits
 */

const { expenses, expensePayers, expenseSplits, householdMembers, users } = schema;

/** Payers or splits of the given expenses, with their member and user */
async function listShares(db: Db, table: typeof expensePayers | typeof expenseSplits, expenseIds: string[]) {
  if (expenseIds.length === 0) return [];
  return db
    .select({
      expenseId: table.expenseId,
      amount: table.amount,
      memberId: householdMembers.id,
      userId: householdMembers.userId,
      status: householdMembers.status,
      displayName: users.displayName,
    })
    .from(table)
    .innerJoin(householdMembers, eq(householdMembers.id, table.memberId))
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(inArray(table.expenseId, expenseIds))
    .orderBy(asc(table.createdAt));
}

type Share = Awaited<ReturnType<typeof listShares>>[number];

const shareShape = (s: Share) => ({
  amount: num(s.amount),
  household_members: { id: s.memberId, user_id: s.userId, status: s.status, users: { display_name: s.displayName } },
});

function mapExpense(e: schema.Expense, payers: Share[], splits: Share[]) {
  return {
    id: e.id,
    description: e.description,
    amount: num(e.amount),
    currency: e.currency,
    expense_date: e.expenseDate,
    expense_kind: e.expenseKind,
    notes: e.notes ?? undefined,
    created_by_user_id: e.createdByUserId,
    household_id: e.householdId,
    created_at: iso(e.createdAt)!,
    updated_at: iso(e.updatedAt)!,
    expense_payers: payers.filter((p) => p.expenseId === e.id).map(shareShape),
    expense_splits: splits.filter((s) => s.expenseId === e.id).map(shareShape),
  };
}

export type ExpenseWithShares = ReturnType<typeof mapExpense>;

/** Non-deleted expenses of a household, most recent first */
export async function listExpenses(db: Db, userId: string, householdId: string): Promise<ExpenseWithShares[]> {
  await requireMember(db, userId, householdId);
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

  const ids = rows.map((e) => e.id);
  const [payers, splits] = await Promise.all([listShares(db, expensePayers, ids), listShares(db, expenseSplits, ids)]);
  return rows.map((e) => mapExpense(e, payers, splits));
}

/** One expense (edit / duplicate). null when missing or not in one of the user's households */
export async function getExpense(db: Db, userId: string, expenseId: string): Promise<ExpenseWithShares | null> {
  if (!isUuid(expenseId)) return null;
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) return null;
  try {
    await requireMember(db, userId, expense.householdId);
  } catch {
    return null;
  }

  const [payers, splits] = await Promise.all([
    listShares(db, expensePayers, [expense.id]),
    listShares(db, expenseSplits, [expense.id]),
  ]);
  return mapExpense(expense, payers, splits);
}

/** Active members, for the payer / beneficiary pickers */
export async function listActiveMembers(db: Db, userId: string, householdId: string) {
  await requireMember(db, userId, householdId);
  const rows = await db
    .select({ member: householdMembers, email: users.email, displayName: users.displayName })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.status, "active")))
    .orderBy(asc(householdMembers.joinedAt));

  return rows.map(({ member, email, displayName }) => ({
    id: member.id,
    user_id: member.userId,
    household_id: member.householdId,
    role: member.role,
    status: member.status,
    users: { display_name: displayName, email },
  }));
}

/** Every id must be a member of the household */
async function requireHouseholdMembers(db: Db, householdId: string, memberIds: string[]) {
  const unique = [...new Set(memberIds)];
  if (unique.length === 0) return;
  if (!unique.every(isUuid)) throw new AccessError();
  const found = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), inArray(householdMembers.id, unique)));
  if (found.length !== unique.length) throw new AccessError("Unknown household member");
}

export interface ExpenseInput {
  description: string;
  amount: string;
  expenseDate: string;
  payerMemberIds: string[];
  splitMemberIds: string[];
  notes?: string;
  currency?: string;
}

/** New expense, split equally between payers and between beneficiaries */
export async function createExpense(db: Db, userId: string, householdId: string, input: ExpenseInput) {
  if (input.payerMemberIds.length === 0) throw new UserError("At least one payer is required");
  if (input.splitMemberIds.length === 0) throw new UserError("At least one participant is required");
  await requireMember(db, userId, householdId);
  await requireHouseholdMembers(db, householdId, [...input.payerMemberIds, ...input.splitMemberIds]);

  const total = parseFloat(input.amount);
  const payerAmount = (total / input.payerMemberIds.length).toFixed(2);
  const splitAmount = (total / input.splitMemberIds.length).toFixed(2);

  return db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        householdId,
        createdByUserId: userId,
        description: input.description,
        amount: String(total),
        expenseDate: input.expenseDate,
        expenseKind: "expense",
        notes: input.notes || null,
        currency: "EUR",
      })
      .returning({ id: expenses.id });

    await tx
      .insert(expensePayers)
      .values(input.payerMemberIds.map((memberId) => ({ expenseId: expense.id, memberId, amount: payerAmount })));
    await tx
      .insert(expenseSplits)
      .values(input.splitMemberIds.map((memberId) => ({ expenseId: expense.id, memberId, amount: splitAmount })));

    return { expenseId: expense.id };
  });
}

/** Edit: replaces the fields, payers and splits */
export async function updateExpense(db: Db, userId: string, expenseId: string, input: ExpenseInput) {
  if (!isUuid(expenseId)) throw new AccessError();
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) throw new AccessError();
  await requireMember(db, userId, expense.householdId);
  await requireHouseholdMembers(db, expense.householdId, [...input.payerMemberIds, ...input.splitMemberIds]);

  const total = parseFloat(input.amount || "0");

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? expense.currency,
        expenseDate: input.expenseDate,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId));

    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId));
    if (input.payerMemberIds.length > 0) {
      await tx.insert(expensePayers).values(
        input.payerMemberIds.map((memberId) => ({
          expenseId,
          memberId,
          amount: String(total / input.payerMemberIds.length),
        }))
      );
    }

    await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    if (input.splitMemberIds.length > 0) {
      await tx.insert(expenseSplits).values(
        input.splitMemberIds.map((memberId) => ({
          expenseId,
          memberId,
          amount: String(total / input.splitMemberIds.length),
        }))
      );
    }
  });
}

/** Soft delete: the expense disappears from lists and balances */
export async function deleteExpense(db: Db, userId: string, expenseId: string) {
  if (!isUuid(expenseId)) throw new AccessError();
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) throw new AccessError();
  await requireMember(db, userId, expense.householdId);
  await db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, expenseId));
}
