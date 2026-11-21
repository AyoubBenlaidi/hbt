import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "@/db/schema";
import { buildMonthlyReport, getMonth } from "@/services/monthlyReport";
import { createTestDb, type TestDb } from "../helpers/db";
import { addMember, createExpense, createHousehold, createUser } from "../helpers/factories";

let db: TestDb;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});
afterAll(async () => {
  await client.close();
});

it("lists the month's expenses and the cumulative balance up to the end of the month", async () => {
  const ayoub = await createUser(db, { displayName: "Ayoub" });
  const marie = await createUser(db, { displayName: "Marie" });
  const { household, ownerMember: a } = await createHousehold(db, ayoub, "B☀️");
  const m = await addMember(db, household, marie);
  const split = (amount: string) => [
    { member: a, amount },
    { member: m, amount },
  ];

  // September: Marie paid 60 for both; October: Ayoub paid 20 for both, Ayoub repaid 10; November: ignored
  await createExpense(db, { household, createdBy: marie, amount: "60", expenseDate: "2026-09-10", payers: [{ member: m, amount: "60" }], splits: split("30") });
  await createExpense(db, { household, createdBy: ayoub, amount: "20", expenseDate: "2026-10-05", description: "Courses", payers: [{ member: a, amount: "20" }], splits: split("10") });
  await createExpense(db, { household, createdBy: ayoub, amount: "10", expenseDate: "2026-10-20", description: "Remboursement", payers: [{ member: a, amount: "10" }], splits: [{ member: m, amount: "10" }] });
  await createExpense(db, { household, createdBy: ayoub, amount: "999", expenseDate: "2026-11-01", payers: [{ member: a, amount: "999" }], splits: split("499.5") });
  const deleted = await createExpense(db, { household, createdBy: ayoub, amount: "500", expenseDate: "2026-10-06", payers: [{ member: a, amount: "500" }], splits: split("250") });
  await db.update(schema.expenses).set({ deletedAt: new Date() }).where(eq(schema.expenses.id, deleted.id));

  const report = await buildMonthlyReport(db, household, getMonth(2026, 10));

  expect(report.monthExpenses.map((e) => [e.date, e.description, e.amountCents, e.paidBy])).toEqual([
    ["2026-10-05", "Courses", 2000, "Ayoub"],
    ["2026-10-20", "Remboursement", 1000, "Ayoub"],
  ]);
  expect(report.monthTotalCents).toBe(3000);
  // Ayoub: paid 30, owes 40 → −10 ; Marie: paid 60, owes 50 → +10
  expect(Object.fromEntries(report.members.map((x) => [x.name, x.balanceCents]))).toEqual({ Ayoub: -1000, Marie: 1000 });
  expect(report.settlements).toEqual([{ fromMemberId: a.id, toMemberId: m.id, amountCents: 1000 }]);
  expect(report.members.find((x) => x.name === "Marie")?.email).toBe(marie.email);
});
