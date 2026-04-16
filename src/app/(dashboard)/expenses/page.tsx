"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { ExpenseItem } from "@/components/expenses/ExpenseItem";
import { colors, spacing } from "@/lib/designSystem";
import { useTranslations } from "@/hooks/useI18n";

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

interface Household {
  id: string;
  name: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslations();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch households
  useEffect(() => {
    if (!user) return;

    const fetchHouseholds = async () => {
      try {
        const { data: memberData } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id);

        const householdIds = memberData?.map((m) => m.household_id) || [];

        if (householdIds.length === 0) {
          setHouseholds([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("households")
          .select("id, name")
          .in("id", householdIds);

        setHouseholds(data || []);
        if (data && data.length > 0) {
          setSelectedHouseholdId(data[0].id);
        }
      } catch (err) {
        console.error("Error fetching households:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHouseholds();
  }, [user]);

  // Fetch expenses for selected household
  useEffect(() => {
    if (!selectedHouseholdId) return;

    const fetchExpenses = async () => {
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
              amount,
              household_members(
                id,
                user_id
              )
            )
          `)
          .eq("household_id", selectedHouseholdId)
          .is("deleted_at", null)
          .order("expense_date", { ascending: false });

        if (err) throw err;
        setExpenses((data || []) as any);
      } catch (err) {
        console.error("Error fetching expenses:", err);
      }
    };

    fetchExpenses();
  }, [selectedHouseholdId]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error: err } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", expenseId);

      if (err) throw err;

      setExpenses(expenses.filter((e) => e.id !== expenseId));
      addToast("Expense deleted successfully!", "success", 2000);
    } catch (err) {
      console.error("Error deleting expense:", err);
      addToast("Failed to delete expense", "error", 2000);
    }
  };

  const handleEditExpense = (expenseId: string) => {
    router.push(`/expenses/${expenseId}/edit`);
  };

  if (authLoading || loading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>Loading...</div>;
  }

  if (households.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: spacing.xl }}>
        <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>{t("expenses.noHouseholds")}</p>
        <ActionButton label={t("expenses.createHousehold")} onClick={() => router.push("/households")} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: spacing.lg,
        paddingBottom: "100px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Household Selector */}
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: spacing.lg }}>{t("expenses.title")}</h1>
        <div style={{ display: "flex", gap: spacing.md, justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
          <div style={{ flex: 1 }}>
            <select
              value={selectedHouseholdId}
              onChange={(e) => setSelectedHouseholdId(e.target.value)}
              style={{
                width: "100%",
                padding: `${spacing.md} ${spacing.xl} ${spacing.md} ${spacing.md}`,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                fontSize: "15px",
                backgroundColor: "white",
                cursor: "pointer",
                appearance: "auto",
              }}
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            label={t("expenses.addExpense")}
            onClick={() => router.push(`/expenses/new?householdId=${selectedHouseholdId}`)}
            style={{ minWidth: "140px" }}
          />
        </div>
      </div>

      {/* Expenses List */}
      <div>
        <PremiumCard>
          <div
            style={{
              marginLeft: `-${spacing.md}px`,
              marginRight: `-${spacing.md}px`,
              marginBottom: `-${spacing.md}px`,
            }}
          >
            {expenses.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {expenses.map((expense) => (
                  <ExpenseItem
                    key={expense.id}
                    expense={expense}
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                  />
                ))}
              </div>
            ) : (
              <p style={{ textAlign: "center", color: colors.text.secondary, paddingTop: spacing.lg, padding: spacing.md }}>
                                {t("expenses.noExpensesYet")}
              </p>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
