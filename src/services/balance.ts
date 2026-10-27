/**
 * Household balance computation
 *
 * All amounts are handled in integer cents to avoid floating point drift.
 * A member's balance is what they paid minus their share:
 *   > 0 → the household owes them money
 *   < 0 → they owe money to the household
 * Repayments are regular expenses (paid by the debtor, split on the creditor),
 * so they are naturally taken into account.
 */

export interface BalanceExpense {
  payers: { memberId: string; amount: string | number }[];
  splits: { memberId: string; amount: string | number }[];
}

export interface Settlement {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export function toCents(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Net balance per member id, in cents
 */
export function computeBalances(expenses: BalanceExpense[]): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (memberId: string, cents: number) =>
    balances.set(memberId, (balances.get(memberId) ?? 0) + cents);

  for (const expense of expenses) {
    for (const payer of expense.payers) add(payer.memberId, toCents(payer.amount));
    for (const split of expense.splits) add(split.memberId, -toCents(split.amount));
  }

  return balances;
}

/**
 * Minimal list of transfers to settle all balances (greedy: largest debtor
 * pays largest creditor). Produces at most n - 1 transfers.
 * Rounding leftovers (a cent or two from equal splits) are left unmatched.
 */
export function computeSettlements(balances: Map<string, number>): Settlement[] {
  const creditors = Array.from(balances, ([memberId, cents]) => ({ memberId, cents }))
    .filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const debtors = Array.from(balances, ([memberId, cents]) => ({ memberId, cents: -cents }))
    .filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amountCents = Math.min(debtors[i].cents, creditors[j].cents);
    settlements.push({
      fromMemberId: debtors[i].memberId,
      toMemberId: creditors[j].memberId,
      amountCents,
    });

    debtors[i].cents -= amountCents;
    creditors[j].cents -= amountCents;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }

  return settlements;
}
