import { describe, expect, it } from "vitest";
import { getMonth, type MonthlyReport } from "@/services/monthlyReport";
import { renderMonthlyReportEmail } from "@/services/email/monthlyReportEmail";

const members = [
  { memberId: "a", userId: "ua", name: "Alice", email: "a@example.com", status: "active", balanceCents: 2500 },
  { memberId: "b", userId: "ub", name: "Bob", email: "b@example.com", status: "active", balanceCents: -2500 },
];

const report = (overrides: Partial<MonthlyReport> = {}): MonthlyReport => ({
  householdId: "h1",
  householdName: "Coloc <3",
  month: getMonth(2026, 10),
  currency: "EUR",
  members,
  monthExpenses: [{ date: "2026-10-03", description: "Courses <b>", amountCents: 5000, paidBy: "Alice" }],
  monthTotalCents: 5000,
  settlements: [{ fromMemberId: "b", toMemberId: "a", amountCents: 2500 }],
  ...overrides,
});

describe("renderMonthlyReportEmail", () => {
  it("elides the month in the subject", () => {
    expect(renderMonthlyReportEmail(report(), members[0]).subject).toBe("Coloc <3 — bilan d'octobre 2026");
    expect(
      renderMonthlyReportEmail(report({ month: getMonth(2026, 9) }), members[0]).subject
    ).toBe("Coloc <3 — bilan de septembre 2026");
  });

  it("personalizes the summary for debtor and creditor", () => {
    expect(renderMonthlyReportEmail(report(), members[1]).text).toMatch(/Tu dois 25,00\s€ à Alice\./); // fr-FR uses a narrow no-break space
    expect(renderMonthlyReportEmail(report(), members[0]).text).toMatch(/Bob te doit 25,00\s€\./);
  });

  it("escapes user content in the HTML", () => {
    const { html } = renderMonthlyReportEmail(report(), members[0]);
    expect(html).toContain("Courses &lt;b&gt;");
    expect(html).toContain("Coloc &lt;3");
    expect(html).not.toContain("Courses <b>");
  });

  it("handles a month without expenses and settled balances", () => {
    const { text } = renderMonthlyReportEmail(
      report({ monthExpenses: [], monthTotalCents: 0, settlements: [] }),
      members[0]
    );
    expect(text).toContain("Aucune dépense ce mois-ci.");
    expect(text).toContain("Tu es à l'équilibre, rien à régler.");
  });
});
