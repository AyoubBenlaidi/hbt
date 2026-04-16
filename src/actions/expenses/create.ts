"use server";

import { createClient } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types";

/**
 * Server Actions for Expense mutations
 * Using Supabase client directly since database is remote
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createExpenseAction(
  householdId: string,
  userId: string,
  description: string,
  amount: string,
  expenseDate: string,
  payerMemberIds: string[],
  splitMemberIds: string[],
  notes?: string
): Promise<ApiResponse<{ expenseId: string }>> {
  try {
    if (payerMemberIds.length === 0) {
      return { success: false, error: "At least one payer is required" };
    }

    if (splitMemberIds.length === 0) {
      return { success: false, error: "At least one participant is required" };
    }

    const totalAmount = parseFloat(amount);
    const payerAmount = (totalAmount / payerMemberIds.length).toFixed(2);
    const splitAmount = (totalAmount / splitMemberIds.length).toFixed(2);

    // Create expense
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by_user_id: userId,
        description,
        amount: totalAmount,
        expense_date: expenseDate,
        expense_kind: "expense",
        notes: notes || null,
        currency: "EUR",
      })
      .select("id")
      .single();

    if (expenseError) {
      console.error("Error creating expense:", expenseError);
      return { success: false, error: "Failed to create expense" };
    }

    const expenseId = expenseData.id;

    // Add payers
    const payersData = payerMemberIds.map((memberId) => ({
      expense_id: expenseId,
      member_id: memberId,
      amount: parseFloat(payerAmount),
    }));

    const { error: payersError } = await supabase
      .from("expense_payers")
      .insert(payersData);

    if (payersError) {
      console.error("Error adding payers:", payersError);
      return { success: false, error: "Failed to add payers" };
    }

    // Add splits
    const splitsData = splitMemberIds.map((memberId) => ({
      expense_id: expenseId,
      member_id: memberId,
      amount: parseFloat(splitAmount),
    }));

    const { error: splitsError } = await supabase
      .from("expense_splits")
      .insert(splitsData);

    if (splitsError) {
      console.error("Error adding splits:", splitsError);
      return { success: false, error: "Failed to add splits" };
    }

    return {
      success: true,
      data: { expenseId },
    };
  } catch (error) {
    console.error("Error in createExpenseAction:", error);
    return {
      success: false,
      error: "Failed to create expense",
    };
  }
}

export async function createTransferAction(
  householdId: string,
  userId: string,
  fromMemberId: string,
  toMemberId: string,
  amount: string,
  transferDate: string,
  description?: string
): Promise<ApiResponse<{ expenseId: string }>> {
  try {
    if (fromMemberId === toMemberId) {
      return { success: false, error: "Transfer must be between different members" };
    }

    const totalAmount = parseFloat(amount);

    // Create transfer as expense
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by_user_id: userId,
        description: description || `Transfer from ${fromMemberId} to ${toMemberId}`,
        amount: totalAmount,
        expense_date: transferDate,
        expense_kind: "transfer",
        currency: "EUR",
      })
      .select("id")
      .single();

    if (expenseError) {
      return { success: false, error: "Failed to create transfer" };
    }

    const expenseId = expenseData.id;

    // Add payer (from member)
    const { error: payerError } = await supabase
      .from("expense_payers")
      .insert({
        expense_id: expenseId,
        member_id: fromMemberId,
        amount: totalAmount,
      });

    if (payerError) {
      return { success: false, error: "Failed to record transfer payer" };
    }

    // Add split (to member)
    const { error: splitError } = await supabase
      .from("expense_splits")
      .insert({
        expense_id: expenseId,
        member_id: toMemberId,
        amount: totalAmount,
      });

    if (splitError) {
      return { success: false, error: "Failed to record transfer recipient" };
    }

    return {
      success: true,
      data: { expenseId },
    };
  } catch (error) {
    console.error("Error in createTransferAction:", error);
    return {
      success: false,
      error: "Failed to create transfer",
    };
  }
}
