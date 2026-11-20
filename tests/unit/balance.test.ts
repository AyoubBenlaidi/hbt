import { describe, expect, it } from "vitest";
import { computeBalances, computeSettlements, toCents } from "@/services/balance";

const expense = (payers: [string, string][], splits: [string, string][]) => ({
  payers: payers.map(([memberId, amount]) => ({ memberId, amount })),
  splits: splits.map(([memberId, amount]) => ({ memberId, amount })),
});

describe("toCents", () => {
  it("converts numeric strings and numbers without float drift", () => {
    expect(toCents("54.59")).toBe(5459);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("130")).toBe(13000);
  });
});

describe("computeBalances", () => {
  it("credits payers and debits beneficiaries", () => {
    const balances = computeBalances([
      expense([["A", "90"]], [["A", "30"], ["B", "30"], ["C", "30"]]),
      expense([["B", "30"]], [["A", "15"], ["B", "15"]]),
    ]);
    expect(Object.fromEntries(balances)).toEqual({ A: 4500, B: -1500, C: -3000 });
  });

  it("takes repayments (paid by the debtor, split on the creditor) into account", () => {
    const balances = computeBalances([
      expense([["A", "100"]], [["A", "50"], ["B", "50"]]),
      expense([["B", "20"]], [["A", "20"]]),
    ]);
    expect(Object.fromEntries(balances)).toEqual({ A: 3000, B: -3000 });
  });

  it("returns an empty map without expenses", () => {
    expect(computeBalances([]).size).toBe(0);
  });
});

describe("computeSettlements", () => {
  it("settles everything with at most n - 1 transfers", () => {
    const balances = new Map([
      ["A", 2500],
      ["B", -1500],
      ["C", -1000],
    ]);
    expect(computeSettlements(balances)).toEqual([
      { fromMemberId: "B", toMemberId: "A", amountCents: 1500 },
      { fromMemberId: "C", toMemberId: "A", amountCents: 1000 },
    ]);
  });

  it("matches the largest debtor with the largest creditor", () => {
    const balances = new Map([
      ["A", 6000],
      ["B", 1000],
      ["C", -5000],
      ["D", -2000],
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements).toEqual([
      { fromMemberId: "C", toMemberId: "A", amountCents: 5000 },
      { fromMemberId: "D", toMemberId: "A", amountCents: 1000 },
      { fromMemberId: "D", toMemberId: "B", amountCents: 1000 },
    ]);
  });

  it("leaves rounding leftovers unmatched", () => {
    // 100 € split in 3 → 33.33 × 3 = 99.99: creditor +66.67, debtors −33.33 each
    const balances = computeBalances([
      expense([["A", "100"]], [["A", "33.33"], ["B", "33.33"], ["C", "33.33"]]),
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements.reduce((sum, s) => sum + s.amountCents, 0)).toBe(6666);
  });

  it("returns nothing when everyone is even", () => {
    expect(computeSettlements(new Map([["A", 0], ["B", 0]]))).toEqual([]);
  });
});
