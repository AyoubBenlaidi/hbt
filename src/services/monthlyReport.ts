import type { SupabaseClient } from "@supabase/supabase-js";
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

const PAGE_SIZE = 1000;

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

async function fetchAllExpenses(supabase: SupabaseClient, householdId: string, end: string) {
  const rows: any[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        `
        id,
        description,
        amount,
        currency,
        expense_date,
        expense_payers ( member_id, amount ),
        expense_splits ( member_id, amount )
      `
      )
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .lte("expense_date", end)
      .order("expense_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function buildMonthlyReport(
  supabase: SupabaseClient,
  household: { id: string; name: string },
  month: ReportMonth
): Promise<MonthlyReport> {
  const { data: membersData, error: membersError } = await supabase
    .from("household_members")
    .select(
      `
      id,
      user_id,
      status,
      users (
        email,
        display_name
      )
    `
    )
    .eq("household_id", household.id);

  if (membersError) throw membersError;

  const expenses = await fetchAllExpenses(supabase, household.id, month.end);

  const balances = computeBalances(
    expenses.map((e) => ({
      payers: (e.expense_payers || []).map((p: any) => ({ memberId: p.member_id, amount: p.amount })),
      splits: (e.expense_splits || []).map((s: any) => ({ memberId: s.member_id, amount: s.amount })),
    }))
  );

  const members: ReportMember[] = (membersData || []).map((m: any) => {
    const user = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      memberId: m.id,
      userId: m.user_id,
      name: user?.display_name || user?.email || "Membre",
      email: user?.email ?? null,
      status: m.status,
      balanceCents: balances.get(m.id) ?? 0,
    };
  });
  const nameOf = (memberId: string) =>
    members.find((m) => m.memberId === memberId)?.name ?? "Membre";

  const monthExpenses: ReportExpense[] = expenses
    .filter((e) => e.expense_date >= month.start)
    .map((e) => ({
      date: e.expense_date,
      description: e.description,
      amountCents: toCents(e.amount),
      paidBy:
        (e.expense_payers || []).map((p: any) => nameOf(p.member_id)).join(", ") || "—",
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
