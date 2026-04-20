"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { ExpenseItem } from "@/components/expenses/ExpenseItem";
import { colors, spacing } from "@/lib/designSystem";
import { useTranslations } from "@/hooks/useI18n";
import { exportHouseholdExpensesToXlsx } from "@/services/exportExpensesToXlsx";

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
  const [exporting, setExporting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
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
            created_at,
            updated_at,
            expense_payers(
              amount,
              household_members(
                id,
                user_id,
                users(
                  display_name
                )
              )
            ),
            expense_splits(
              amount,
              household_members(
                id,
                user_id,
                users(
                  display_name
                )
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

  const handleExportExpenses = async () => {
    if (!selectedHouseholdId) {
      addToast(t("expenses.noHouseholdSelected"), "info", 2000);
      return;
    }

    try {
      setExporting(true);
      const selectedHousehold = households.find((h) => h.id === selectedHouseholdId);
      if (!selectedHousehold) {
        addToast(t("expenses.noHouseholdSelected"), "error", 2000);
        return;
      }

      // Export filtered expenses
      await exportHouseholdExpensesToXlsx(filteredExpenses, selectedHousehold.name);
      addToast(t("expenses.exportSuccess"), "success", 2000);
    } catch (err) {
      console.error("Error exporting expenses:", err);
      addToast(t("expenses.exportError"), "error", 2000);
    } finally {
      setExporting(false);
    }
  };

  // Generate intelligent filters based on expense dates
  const generateFilters = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const filters: { id: string; label: string; year?: number; month?: number }[] = [];
    const yearsWithExpenses = new Set<number>();
    const monthsInCurrentYear = new Set<number>();

    expenses.forEach((exp) => {
      const date = new Date(exp.expense_date);
      const expYear = date.getFullYear();
      const expMonth = date.getMonth();

      if (expYear === currentYear) {
        monthsInCurrentYear.add(expMonth);
      } else {
        yearsWithExpenses.add(expYear);
      }
    });

    // Add months for current year (if any)
    if (monthsInCurrentYear.size > 0) {
      const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
      ];
      
      const sortedMonths = Array.from(monthsInCurrentYear).sort((a, b) => b - a);
      sortedMonths.forEach((month) => {
        filters.push({
          id: `${currentYear}-${month}`,
          label: t(`expenses.${monthNames[month]}`),
          year: currentYear,
          month,
        });
      });
    }

    // Add years for past/future years
    const sortedYears = Array.from(yearsWithExpenses).sort((a, b) => b - a);
    sortedYears.forEach((year) => {
      filters.push({
        id: `${year}`,
        label: `${year}`,
        year,
      });
    });

    return filters;
  };

  // Filter expenses based on selected filter
  const getFilteredExpenses = () => {
    if (selectedFilter === "all") return expenses;

    const now = new Date();
    const currentYear = now.getFullYear();

    return expenses.filter((exp) => {
      const date = new Date(exp.expense_date);
      const expYear = date.getFullYear();
      const expMonth = date.getMonth();

      if (selectedFilter.includes("-")) {
        // Month filter (format: YYYY-M)
        const [filterYear, filterMonth] = selectedFilter.split("-");
        return expYear === parseInt(filterYear) && expMonth === parseInt(filterMonth);
      } else {
        // Year filter
        return expYear === parseInt(selectedFilter);
      }
    });
  };

  const filters = generateFilters();
  const filteredExpenses = getFilteredExpenses();

  if (authLoading || loading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>{t("common.loading")}</div>;
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
      {/* Page Title with Export Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700" }}>{t("expenses.title")}</h1>
        <button
          onClick={handleExportExpenses}
          disabled={exporting || filteredExpenses.length === 0}
          aria-label={t("expenses.export")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            padding: `${spacing.xs} ${spacing.md}`,
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            backgroundColor: colors.card,
            color: exporting ? colors.text.muted : colors.text.primary,
            fontSize: "14px",
            fontWeight: "500",
            cursor: exporting || filteredExpenses.length === 0 ? "not-allowed" : "pointer",
            opacity: exporting || filteredExpenses.length === 0 ? 0.6 : 1,
            transition: `all 150ms ease-out`,
          }}
          onMouseEnter={(e) => {
            if (!exporting && filteredExpenses.length > 0) {
              e.currentTarget.style.backgroundColor = colors.hover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.card;
          }}
        >
          <Download size={16} />
          {exporting ? t("expenses.exporting") : t("expenses.export")}
        </button>
      </div>

      {/* Household Selector */}
      <div>
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

      {/* Month/Year Filters */}
      {filters.length > 0 && (
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => setSelectedFilter("all")}
            style={{
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: "20px",
              border: `1px solid ${selectedFilter === "all" ? colors.primary : colors.border}`,
              backgroundColor: selectedFilter === "all" ? colors.primary : "transparent",
              color: selectedFilter === "all" ? "white" : colors.text.primary,
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              transition: `all 150ms ease-out`,
            }}
            onMouseEnter={(e) => {
              if (selectedFilter !== "all") {
                e.currentTarget.style.backgroundColor = colors.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFilter !== "all") {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            {t("expenses.allTime")}
          </button>

          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              style={{
                padding: `${spacing.xs} ${spacing.md}`,
                borderRadius: "20px",
                border: `1px solid ${selectedFilter === filter.id ? colors.primary : colors.border}`,
                backgroundColor: selectedFilter === filter.id ? colors.primary : "transparent",
                color: selectedFilter === filter.id ? "white" : colors.text.primary,
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                transition: `all 150ms ease-out`,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (selectedFilter !== filter.id) {
                  e.currentTarget.style.backgroundColor = colors.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFilter !== filter.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

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
            {filteredExpenses.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredExpenses.map((expense) => (
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
                {selectedFilter === "all" ? t("expenses.noExpensesYet") : t("expenses.noExpensesInPeriod")}
              </p>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
