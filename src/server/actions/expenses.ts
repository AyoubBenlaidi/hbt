"use server";

import * as data from "@/server/data/expenses";
import { run } from "./run";

export async function listExpenses(householdId: string) {
  return run(({ db, userId }) => data.listExpenses(db, userId, householdId));
}

export async function getExpense(expenseId: string) {
  return run(({ db, userId }) => data.getExpense(db, userId, expenseId));
}

export async function listActiveMembers(householdId: string) {
  return run(({ db, userId }) => data.listActiveMembers(db, userId, householdId));
}

export async function createExpense(householdId: string, input: data.ExpenseInput) {
  return run(({ db, userId }) => data.createExpense(db, userId, householdId, input));
}

export async function updateExpense(expenseId: string, input: data.ExpenseInput) {
  return run(({ db, userId }) => data.updateExpense(db, userId, expenseId, input));
}

export async function deleteExpense(expenseId: string) {
  return run(({ db, userId }) => data.deleteExpense(db, userId, expenseId));
}
