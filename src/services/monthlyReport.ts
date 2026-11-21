import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/server/data/common";
import { computeBalances, computeSettlements, toCents, type Settlement } from "@/services/balance";

/**
 * Monthly household report
 * Lists the expenses of a given month and the cumulative balance
 * (all expenses since the household was created, up to the end of that month).
 */

export interface ReportMonth {
  /** First day, yyyy-mm-dd */
  start: string;
  /** Last day, yyyy-mm-dd */
  end: string;
  /** e.g. "septembre 2026" */
  label: string;
  /** e.g. "2026-09", used as idempotency key */
  key: string;
}

export interface ReportMember {
  memberId: string;
  userId: string;
  name: string;
  email: string | null;
  status: string;
  balanceCents: number;
}

export interface ReportExpense {
  date: string;
  description: string;
  amountCents: number;
  paidBy: string;
}

export interface MonthlyReport {
  householdId: string;
  householdName: string;
  month: ReportMonth;
  currency: string;
  members: ReportMember[];
  monthExpenses: ReportExpense[];
  monthTotalCents: number;
  settlements: Settlement[];
}

const { expenses, expensePayers, expenseSplits, householdMembers, users } = schema;

/**
 * Previous calendar month relative to `now`, in Europe/Paris time
 */
export function getPreviousMonth(now: Date = new Date()): ReportMonth {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);

  return month === 1 ? getMonth(year - 1, 12) : getMonth(year, month - 1);
}

/**
 * @param month 1-12
 */
export function getMonth(year: number, month: number): ReportMonth {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    label,
    key: `${year}-${mm}`,
  };
}

async function fetchAllExpenses(db: Db, householdId: string, end: string) {
  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      currency: expenses.currency,
      expense_date: expenses.expenseDate,
    })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNull(expenses.deletedAt), lte(expenses.expenseDate, end)))
    .orderBy(asc(expenses.expenseDate), asc(expenses.id));

  const ids = rows.map((e) => e.id);
  const shares = async (table: typeof expensePayers | typeof expenseSplits) =>
    ids.length === 0
      ? []
      : db
          .select({ expenseId: table.expenseId, member_id: table.memberId, amount: table.amount })
          .from(table)
          .where(inArray(table.expenseId, ids));
  const [payers, splits] = await Promise.all([shares(expensePayers), shares(expenseSplits)]);

  return rows.map((e) => ({
    ...e,
    expense_payers: payers.filter((p) => p.expenseId === e.id),
    expense_splits: splits.filter((s) => s.expenseId === e.id),
  }));
}

export async function buildMonthlyReport(
  db: Db,
  household: { id: string; name: string },
  month: ReportMonth
): Promise<MonthlyReport> {
  const membersData = await db
    .select({
      id: householdMembers.id,
      user_id: householdMembers.userId,
      status: householdMembers.status,
      email: users.email,
      display_name: users.displayName,
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, household.id));

  const expenses = await fetchAllExpenses(db, household.id, month.end);

  const balances = computeBalances(
    expenses.map((e) => ({
      payers: e.expense_payers.map((p) => ({ memberId: p.member_id, amount: p.amount })),
      splits: e.expense_splits.map((s) => ({ memberId: s.member_id, amount: s.amount })),
    }))
  );

  const members: ReportMember[] = membersData.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    name: m.display_name || m.email || "Membre",
    email: m.email ?? null,
    status: m.status,
    balanceCents: balances.get(m.id) ?? 0,
  }));
  const nameOf = (memberId: string) =>
    members.find((m) => m.memberId === memberId)?.name ?? "Membre";

  const monthExpenses: ReportExpense[] = expenses
    .filter((e) => e.expense_date >= month.start)
    .map((e) => ({
      date: e.expense_date,
      description: e.description,
      amountCents: toCents(e.amount),
      paidBy:
        e.expense_payers.map((p) => nameOf(p.member_id)).join(", ") || "—",
    }));

  return {
    householdId: household.id,
    householdName: household.name,
    month,
    currency: expenses[0]?.currency || "EUR",
    members,
    monthExpenses,
    monthTotalCents: monthExpenses.reduce((sum, e) => sum + e.amountCents, 0),
    settlements: computeSettlements(balances),
  };
}
