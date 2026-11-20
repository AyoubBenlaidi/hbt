"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { unwrap } from "@/lib/actionResult";
import { getExpense } from "@/server/actions/expenses";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { colors, spacing } from "@/lib/designSystem";

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  expense_kind: string;
  notes?: string;
  created_by_user_id: string;
  household_id: string;
}

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const expenseId = params.id as string;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch expense
  useEffect(() => {
    if (!expenseId) return;

    const fetchExpense = async () => {
      try {
        const data = unwrap(await getExpense(expenseId));

        if (!data) {
          setError("Expense not found");
          return;
        }

        setExpense(data as any);
      } catch (err) {
        console.error("Error fetching expense:", err);
        setError("Failed to load expense");
      } finally {
        setLoading(false);
      }
    };

    fetchExpense();
  }, [expenseId]);

  if (!authLoading && !isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return <div style={{ textAlign: "center", paddingTop: spacing.xl }}>Loading...</div>;
  }

  if (error || !expense) {
    return (
      <div style={{ textAlign: "center", paddingTop: spacing.xl }}>
        <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {error || "Expense not found"}
        </p>
      </div>
    );
  }

  return (
    <ExpenseForm
      householdId={expense.household_id}
      expenseId={expense.id}
      initialExpense={expense}
      onSuccess={() => router.push("/expenses")}
    />
  );
}
