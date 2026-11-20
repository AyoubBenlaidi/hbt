import { and, asc, eq, isNull, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { num, type Db } from "./common";

/**
 * Dashboard: per household, what the user paid and owes, and the household total
 */

const { households, householdMembers, expenses, expensePayers, expenseSplits } = schema;

export interface DashboardTransaction {
  id: string;
  expenseId: string;
  expenseAmount: number;
  type: "paid" | "owed";
  description: string;
  amount: number;
  date: string;
  expenseKind: string;
}

export interface DashboardHousehold {
  householdId: string;
  householdName: string;
  transactions: DashboardTransaction[];
  totalSpentAllTime: number;
}

async function listUserShares(
  db: Db,
  table: typeof expensePayers | typeof expenseSplits,
  memberId: string,
  householdId: string,
  type: "paid" | "owed"
): Promise<DashboardTransaction[]> {
  const rows = await db
    .select({
      id: table.id,
      amount: table.amount,
      expenseId: expenses.id,
      expenseAmount: expenses.amount,
      description: expenses.description,
      date: expenses.expenseDate,
      expenseKind: expenses.expenseKind,
    })
    .from(table)
    .innerJoin(expenses, eq(expenses.id, table.expenseId))
    .where(and(eq(table.memberId, memberId), eq(expenses.householdId, householdId), isNull(expenses.deletedAt)));

  return rows.map((r) => ({
    id: r.id,
    expenseId: r.expenseId,
    expenseAmount: num(r.expenseAmount),
    type,
    description: r.description,
    amount: num(r.amount),
    date: r.date,
    expenseKind: r.expenseKind,
  }));
}

export async function getDashboard(db: Db, userId: string): Promise<DashboardHousehold[]> {
  const memberships = await db
    .select({ memberId: householdMembers.id, householdId: households.id, householdName: households.name })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(and(eq(householdMembers.userId, userId), eq(householdMembers.status, "active")))
    .orderBy(asc(households.createdAt));

  return Promise.all(
    memberships.map(async ({ memberId, householdId, householdName }) => {
      const [paid, owed, [total]] = await Promise.all([
        listUserShares(db, expensePayers, memberId, householdId, "paid"),
        listUserShares(db, expenseSplits, memberId, householdId, "owed"),
        db
          .select({ sum: sql<string>`coalesce(sum(${expenseSplits.amount}), 0)` })
          .from(expenseSplits)
          .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
          .where(and(eq(expenses.householdId, householdId), isNull(expenses.deletedAt))),
      ]);

      const transactions = [...paid, ...owed].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return { householdId, householdName, transactions, totalSpentAllTime: num(total.sum) };
    })
  );
}
