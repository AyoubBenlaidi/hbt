"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/hooks/useI18n";
import { supabase } from "@/lib/supabase/client";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { colors, spacing } from "@/lib/designSystem";

/**
 * Today's date (local time) as yyyy-mm-dd
 */
function today(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export default function NewExpenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslations();
  const householdId = searchParams.get("householdId");
  const duplicateFrom = searchParams.get("duplicateFrom");
  const [template, setTemplate] = useState<any>(null);
  const [templateLoading, setTemplateLoading] = useState(!!duplicateFrom);
  const [templateError, setTemplateError] = useState(false);

  // Load the expense to duplicate
  useEffect(() => {
    if (!duplicateFrom || !householdId) return;

    const fetchTemplate = async () => {
      try {
        const { data, error: err } = await supabase
          .from("expenses")
          .select(`
            id,
            description,
            amount,
            currency,
            expense_date,
            expense_kind,
            notes,
            created_by_user_id,
            household_id,
            expense_payers(
              household_members(
                id,
                user_id,
                status
              )
            ),
            expense_splits(
              household_members(
                id,
                user_id,
                status
              )
            )
          `)
          .eq("id", duplicateFrom)
          .eq("household_id", householdId)
          .single();

        if (err) throw err;

        // Members who left the household can't be selected anymore
        const isActive = (row: any) => row.household_members?.status === "active";
        setTemplate({
          ...data,
          expense_date: today(),
          expense_payers: (data.expense_payers || []).filter(isActive),
          expense_splits: (data.expense_splits || []).filter(isActive),
        });
      } catch (err) {
        console.error("Error fetching expense to duplicate:", err);
        setTemplateError(true);
      } finally {
        setTemplateLoading(false);
      }
    };

    fetchTemplate();
  }, [duplicateFrom, householdId]);

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

  if (duplicateFrom) {
    if (templateLoading) {
      return <div style={{ textAlign: "center", paddingTop: spacing.xl }}>Loading...</div>;
    }

    if (templateError || !template) {
      return (
        <div style={{ textAlign: "center", paddingTop: spacing.xl }}>
          <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
            {t("expenses.duplicateNotFound")}
          </p>
        </div>
      );
    }
  }

  return (
    <ExpenseForm
      householdId={householdId}
      initialExpense={template ?? undefined}
      isDuplicate={!!template}
      onSuccess={() => router.push("/expenses")}
    />
  );
}
