"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { colors, spacing } from "@/lib/designSystem";

export default function NewExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const householdId = searchParams.get("householdId");

  if (!authLoading && !isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (!householdId) {
    return (
      <div style={{ textAlign: "center", paddingTop: spacing.xl }}>
        <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          Invalid household. Please select one from the expenses list.
        </p>
      </div>
    );
  }

  return (
    <ExpenseForm
      householdId={householdId}
      onSuccess={() => router.push("/expenses")}
    />
  );
}
