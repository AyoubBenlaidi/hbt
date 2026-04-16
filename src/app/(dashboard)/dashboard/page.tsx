"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { colors, spacing } from "@/lib/designSystem";
import { CalendarIcon, ClockIcon, InfinityIcon } from "@/components/icons/NavigationIcons";
import { useTranslations } from "@/hooks/useI18n";

interface Transaction {
  id: string;
  expenseId: string;
  expenseAmount: number;
  type: "paid" | "owed";
  description: string;
  amount: number;
  date: string;
  expenseKind: string;
}

interface HouseholdTransactions {
  householdId: string;
  householdName: string;
  transactions: Transaction[];
  totalSpentAllTime: number;
}

interface DateRange {
  start: string;
  end: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [householdTransactions, setHouseholdTransactions] = useState<HouseholdTransactions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // Filter state
  const [filterPeriod, setFilterPeriod] = useState<"thisMonth" | "custom" | "allTime">("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<DateRange | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useTranslations();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Load custom date range from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("customDateRange");
    if (saved) {
      try {
        setCustomDateRange(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved date range:", e);
      }
    }

    // Detect mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Save custom date range to localStorage
  useEffect(() => {
    if (customDateRange) {
      localStorage.setItem("customDateRange", JSON.stringify(customDateRange));
    }
  }, [customDateRange]);

  // Helper: Format date range for display
  const formatDateRangeDisplay = (range: DateRange): string => {
    const start = new Date(range.start);
    const end = new Date(range.end);
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startStr} → ${endStr}`;
  };

  // Helper: Get quick range presets
  const getQuickRange = (type: "last7" | "last30" | "thisMonth"): DateRange => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endStr = today.toISOString().split("T")[0];
    let start = new Date(today);

    if (type === "last7") {
      start.setDate(start.getDate() - 7);
    } else if (type === "last30") {
      start.setDate(start.getDate() - 30);
    } else if (type === "thisMonth") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const startStr = start.toISOString().split("T")[0];
    return { start: startStr, end: endStr };
  };

  // Helper: Get date range based on filter
  const getDateRange = (): { start: Date; end: Date } => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (filterPeriod === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: today };
    }

    if (filterPeriod === "custom" && customDateRange) {
      return {
        start: new Date(customDateRange.start),
        end: new Date(customDateRange.end),
      };
    }

    // "allTime"
    return {
      start: new Date(1970, 0, 1),
      end: today,
    };
  };

  // Helper: Filter transactions by date range
  const filterTransactionsByDateRange = (transactions: Transaction[]): Transaction[] => {
    const { start, end } = getDateRange();
    return transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= start && tDate <= end;
    });
  };

  // ========== MONTHLY AGGREGATION HELPERS ==========

  interface MonthlyData {
    monthKey: string;
    monthLabel: string;
    year: number;
    paid: number;
    owed: number;
    displayLabel: string;
  }

  // Aggregate expenses by month
  const aggregateExpensesByMonth = (transactions: Transaction[]): MonthlyData[] => {
    const monthMap = new Map<string, { paid: number; owed: number }>();

    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(monthKey) || { paid: 0, owed: 0 };
      
      if (t.type === "paid") {
        existing.paid += t.amount;
      } else {
        existing.owed += t.amount;
      }
      monthMap.set(monthKey, existing);
    });

    // Convert to sorted array
    return Array.from(monthMap.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split("-");
        const monthNum = parseInt(month);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return {
          monthKey,
          monthLabel: monthNames[monthNum - 1],
          year: parseInt(year),
          paid: data.paid,
          owed: data.owed,
          displayLabel: monthNames[monthNum - 1],
        };
      })
      .sort((a, b) => `${a.year}${a.monthKey}`.localeCompare(`${b.year}${b.monthKey}`));
  };

  // Build smart x-axis labels based on data span
  const buildSmartXAxisLabels = (data: MonthlyData[]): Map<number, { label: string; isYearBreak: boolean }> => {
    const labels = new Map<number, { label: string; isYearBreak: boolean }>();
    
    if (data.length === 0) return labels;

    const monthCount = data.length;

    if (monthCount <= 12) {
      // Show every month, include year on transitions
      let prevYear = -1;
      data.forEach((d, idx) => {
        const isYearBreak = d.year !== prevYear;
        labels.set(idx, {
          label: isYearBreak ? `${d.monthLabel} ${d.year}` : d.monthLabel,
          isYearBreak,
        });
        prevYear = d.year;
      });
    } else if (monthCount <= 24) {
      // Show every other month, always show year changes
      let prevYear = -1;
      data.forEach((d, idx) => {
        const isYearBreak = d.year !== prevYear;
        const isEveryOther = idx % 2 === 0;
        
        if (isEveryOther || isYearBreak) {
          labels.set(idx, {
            label: isYearBreak ? `${d.monthLabel} ${d.year}` : d.monthLabel,
            isYearBreak,
          });
        }
        prevYear = d.year;
      });
    } else {
      // Show quarterly labels (Jan, Apr, Jul, Oct) + year changes
      let prevYear = -1;
      data.forEach((d, idx) => {
        const monthNum = parseInt(d.monthKey.split("-")[1]);
        const isQuarterStart = monthNum === 1 || monthNum === 4 || monthNum === 7 || monthNum === 10;
        const isYearBreak = d.year !== prevYear;
        
        if (isQuarterStart || isYearBreak) {
          labels.set(idx, {
            label: isYearBreak ? `${d.monthLabel} ${d.year}` : d.monthLabel,
            isYearBreak,
          });
        }
        prevYear = d.year;
      });
    }

    return labels;
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // Get user's household memberships
        const { data: memberData, error: memberError } = await supabase
          .from("household_members")
          .select("id, household_id")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (memberError) throw memberError;

        const householdIds = memberData?.map((m) => m.household_id) || [];

        if (householdIds.length === 0) {
          setHouseholdTransactions([]);
          setLoading(false);
          return;
        }

        // Get households
        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("id, name")
          .in("id", householdIds);

        if (householdError) throw householdError;

        // Get transactions for each household
        const allTransactions: HouseholdTransactions[] = [];

        for (const household of householdData || []) {
          const userMember = memberData?.find((m) => m.household_id === household.id);

          if (!userMember) continue;

          // Get payer transactions
          const { data: payerExpenses, error: payerError } = await supabase
            .from("expense_payers")
            .select(
              `
              id,
              amount,
              expenses (
                id,
                description,
                expense_date,
                expense_kind,
                amount,
                deleted_at,
                household_id
              )
            `
            )
            .eq("member_id", userMember.id);

          if (payerError) throw payerError;

          // Get split transactions (my splits only)
          const { data: splitExpenses, error: splitError } = await supabase
            .from("expense_splits")
            .select(
              `
              id,
              amount,
              expenses (
                id,
                description,
                expense_date,
                expense_kind,
                amount,
                deleted_at,
                household_id
              )
            `
            )
            .eq("member_id", userMember.id);

          if (splitError) throw splitError;

          // Get ALL splits for this household (for total spent calculation)
          const { data: allHouseholdSplits, error: allSplitsError } = await supabase
            .from("expense_splits")
            .select("amount, expenses(household_id, deleted_at)")
            .eq("expenses.household_id", household.id);

          if (allSplitsError) throw allSplitsError;

          // Calculate total spent from all splits
          const totalSpentAllTime = (allHouseholdSplits || []).reduce((sum, split: any) => {
            if (split.expenses && !split.expenses.deleted_at) {
              return sum + parseFloat(split.amount);
            }
            return sum;
          }, 0);

          const transactions: Transaction[] = [];

          // Add payer transactions
          (payerExpenses || []).forEach((payer: any) => {
            if (
              payer.expenses &&
              payer.expenses.household_id === household.id &&
              !payer.expenses.deleted_at
            ) {
              transactions.push({
                id: payer.id,
                expenseId: payer.expenses.id,
                expenseAmount: parseFloat(payer.expenses.amount),
                type: "paid",
                description: payer.expenses.description,
                amount: parseFloat(payer.amount),
                date: payer.expenses.expense_date,
                expenseKind: payer.expenses.expense_kind,
              });
            }
          });

          // Add split transactions
          (splitExpenses || []).forEach((split: any) => {
            if (
              split.expenses &&
              split.expenses.household_id === household.id &&
              !split.expenses.deleted_at
            ) {
              transactions.push({
                id: split.id,
                expenseId: split.expenses.id,
                expenseAmount: parseFloat(split.expenses.amount),
                type: "owed",
                description: split.expenses.description,
                amount: parseFloat(split.amount),
                date: split.expenses.expense_date,
                expenseKind: split.expenses.expense_kind,
              });
            }
          });

          // Sort by date descending
          transactions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          allTransactions.push({
            householdId: household.id,
            householdName: household.name,
            transactions,
            totalSpentAllTime,
          });
        }

        setHouseholdTransactions(allTransactions);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>Loading...</div>;
  }

  // Calculate global balance (all time for hero block)
  const globalTotalPaidAllTime = householdTransactions.reduce((sum, ht) => {
    return sum + ht.transactions.filter((t) => t.type === "paid").reduce((s, t) => s + t.amount, 0);
  }, 0);

  const globalTotalOwedAllTime = householdTransactions.reduce((sum, ht) => {
    return sum + ht.transactions.filter((t) => t.type === "owed").reduce((s, t) => s + t.amount, 0);
  }, 0);

  const netBalanceAllTime = globalTotalPaidAllTime - globalTotalOwedAllTime;

  // ========== MONTHLY BAR CHART COMPONENT ==========
  const MonthlyBarChart = ({ monthlyData }: { monthlyData: MonthlyData[] }) => {
    const xAxisLabels = buildSmartXAxisLabels(monthlyData);
    
    // Find max value for scaling
    const maxValue = Math.max(...monthlyData.map((d) => Math.max(d.paid, d.owed)), 1);
    const chartHeight = 200;
    const barGroupWidth = 100 / monthlyData.length;
    
    // Calculate summary metrics
    const totalPaid = monthlyData.reduce((sum, d) => sum + d.paid, 0);
    const totalOwed = monthlyData.reduce((sum, d) => sum + d.owed, 0);
    const netAllTime = totalPaid - totalOwed;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {/* Summary Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md }}>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("dashboard.allTimePaid")}
            </p>
            <p style={{ fontSize: "18px", fontWeight: "700", color: colors.success }}>
              +€{totalPaid.toFixed(2)}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("dashboard.allTimeOwed")}
            </p>
            <p style={{ fontSize: "18px", fontWeight: "700", color: colors.danger }}>
              -€{totalOwed.toFixed(2)}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("dashboard.netAllTime")}
            </p>
            <p style={{ fontSize: "18px", fontWeight: "700", color: netAllTime > 0 ? colors.success : netAllTime < 0 ? colors.danger : colors.text.primary }}>
              {netAllTime > 0 ? "+" : ""}{netAllTime.toFixed(2)}€
            </p>
          </div>
        </div>

        {/* Chart Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {/* Y Axis Labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Chart Area */}
            <div style={{ display: "flex", gap: spacing.sm }}>
              {/* Y-Axis Labels */}
              <div style={{ width: "40px", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "right" }}>
                {[1, 0.5, 0].map((ratio) => (
                  <p
                    key={ratio}
                    style={{
                      fontSize: "10px",
                      color: colors.text.secondary,
                      height: "0px",
                      marginBottom: `${chartHeight * ratio}px`,
                    }}
                  >
                    €{(maxValue * ratio).toFixed(0)}
                  </p>
                ))}
              </div>

              {/* Bars Container */}
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: `${chartHeight}px`,
                  borderBottom: `1px solid ${colors.border}`,
                  borderLeft: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: barGroupWidth > 3 ? "4px" : "1px",
                  paddingBottom: "4px",
                  paddingLeft: "4px",
                  overflow: monthlyData.length > 24 ? "auto" : "visible",
                }}
              >
                {monthlyData.map((month, idx) => {
                  const paidHeight = (month.paid / maxValue) * chartHeight;
                  const owedHeight = (month.owed / maxValue) * chartHeight;
                  const hasLabel = xAxisLabels.has(idx);
                  const isYearBreak = xAxisLabels.get(idx)?.isYearBreak || false;

                  return (
                    <div
                      key={month.monthKey}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flex: 1,
                        minWidth: monthlyData.length > 24 ? "60px" : "auto",
                        gap: "2px",
                        paddingTop: isYearBreak && idx > 0 ? "20px" : "12px",
                        borderTop: isYearBreak && idx > 0 ? `2px solid ${colors.border}` : "none",
                      }}
                    >
                      {/* Bars */}
                      <div
                        style={{
                          display: "flex",
                          gap: "2px",
                          alignItems: "flex-end",
                          height: `${chartHeight}px`,
                        }}
                      >
                        {/* Paid Bar */}
                        {paidHeight > 0 && (
                          <div
                            style={{
                              width: "8px",
                              height: `${paidHeight}px`,
                              backgroundColor: colors.success,
                              borderRadius: "4px 4px 0 0",
                              transition: "opacity 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "0.7";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "1";
                            }}
                            title={`${month.monthLabel} ${month.year}: €${month.paid.toFixed(2)} paid`}
                          />
                        )}
                        {/* Owed Bar */}
                        {owedHeight > 0 && (
                          <div
                            style={{
                              width: "8px",
                              height: `${owedHeight}px`,
                              backgroundColor: colors.danger,
                              borderRadius: "4px 4px 0 0",
                              transition: "opacity 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "0.7";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = "1";
                            }}
                            title={`${month.monthLabel} ${month.year}: €${month.owed.toFixed(2)} owed`}
                          />
                        )}
                      </div>

                      {/* Label */}
                      {hasLabel && (
                        <p style={{ fontSize: "10px", color: colors.text.secondary, fontWeight: "600", marginTop: "4px", whiteSpace: "nowrap" }}>
                          {xAxisLabels.get(idx)?.label}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: spacing.lg, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: colors.success, borderRadius: "2px" }} />
              <p style={{ fontSize: "12px", color: colors.text.secondary }}>{t("households.paid")}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <div style={{ width: "12px", height: "12px", backgroundColor: colors.danger, borderRadius: "2px" }} />
              <p style={{ fontSize: "12px", color: colors.text.secondary }}>{t("households.owed")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: "100px", display: "flex", flexDirection: "column", gap: spacing.lg, width: "100%", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700" }}>Dashboard</h1>

      {error && (
        <div style={{ padding: spacing.md, backgroundColor: `rgba(168, 95, 95, 0.1)`, border: `1px solid ${colors.danger}`, borderRadius: "8px", color: colors.danger, fontSize: "14px" }}>
          {error}
        </div>
      )}

      {householdTransactions.length === 0 ? (
        <PremiumCard>
          <div style={{ textAlign: "center", padding: spacing.xl }}>
            <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
              No transactions yet. Create or join a household to get started.
            </p>
            <div style={{ display: "flex", gap: spacing.md, justifyContent: "center", flexWrap: "wrap" }}>
              <ActionButton label={t("nav.households")} onClick={() => router.push("/households")} variant="secondary" />
              <ActionButton label={t("expenses.addExpense")} onClick={() => router.push("/expenses")} />
            </div>
          </div>
        </PremiumCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {/* Global Balance Hero Block */}
          <PremiumCard elevated>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: isMobile ? spacing.md : spacing.md,
                width: "100%",
              }}
            >
              {/* Net Balance */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, paddingRight: isMobile ? 0 : spacing.md, borderRight: !isMobile && netBalanceAllTime !== 0 ? `1px solid ${colors.border}` : "none", paddingBottom: isMobile ? spacing.md : 0, borderBottom: isMobile ? `1px solid ${colors.border}` : "none" }}>
                <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("dashboard.netBalance")}
                </p>
                <p
                  style={{
                    fontSize: "clamp(18px, 4vw, 32px)",
                    fontWeight: "700",
                    color: netBalanceAllTime > 0 ? colors.success : netBalanceAllTime < 0 ? colors.danger : colors.text.primary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {netBalanceAllTime > 0 ? "+" : ""}{netBalanceAllTime.toFixed(2)}€
                </p>
              </div>

              {/* You Owe */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, paddingRight: isMobile ? 0 : spacing.md, borderRight: isMobile ? "none" : `1px solid ${colors.border}`, paddingBottom: isMobile ? spacing.md : 0, borderBottom: isMobile ? `1px solid ${colors.border}` : "none" }}>
                <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("dashboard.youOwe")}
                </p>
                <p style={{ fontSize: "clamp(18px, 4vw, 32px)", fontWeight: "700", color: colors.danger, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  -{globalTotalOwedAllTime.toFixed(2)}€
                </p>
              </div>

              {/* You Paid */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                <p style={{ fontSize: "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("dashboard.youPaid")}
                </p>
                <p style={{ fontSize: "clamp(18px, 4vw, 32px)", fontWeight: "700", color: colors.success, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  +{globalTotalPaidAllTime.toFixed(2)}€
                </p>
              </div>
            </div>
          </PremiumCard>

          {/* Premium Minimal Period Switch */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start", width: "100%" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "48px",
                padding: "4px",
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: "16px",
                gap: "0px",
                minWidth: "100%",
              }}
            >
              {(["thisMonth", "allTime", "custom"] as const).map((period) => {
                const isActive = filterPeriod === period;
                let displayLabel = "";

                if (period === "thisMonth") {
                  displayLabel = t("dashboard.thisMonth");
                } else if (period === "custom") {
                  displayLabel = customDateRange ? formatDateRangeDisplay(customDateRange) : t("dashboard.range");
                } else if (period === "allTime") {
                  displayLabel = t("dashboard.allTime");
                }

                return (
                  <button
                    key={period}
                    onClick={() => {
                      if (period === "custom") {
                        setTempDateRange(customDateRange || getQuickRange("thisMonth"));
                        setShowModal(true);
                      } else {
                        setFilterPeriod(period);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: "100px",
                      padding: `${spacing.sm} ${spacing.md}`,
                      height: "40px",
                      backgroundColor: isActive ? colors.primary : "transparent",
                      color: isActive ? "#fff" : colors.text.primary,
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: `all 0.18s cubic-bezier(0.2, 0, 0.38, 0.9)`,
                      textTransform: "none",
                      letterSpacing: "0px",
                      boxShadow: isActive ? `0 2px 6px rgba(30, 58, 95, 0.12)` : "none",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    {period === "thisMonth" && <CalendarIcon size={16} color={isActive ? "#fff" : colors.text.primary} strokeWidth={2} />}
                    {period === "allTime" && <InfinityIcon size={16} color={isActive ? "#fff" : colors.text.primary} strokeWidth={2} />}
                    {displayLabel}
                  </button>
                );
              })}
            </div>

            {/* Selected Range Caption (Mobile & Desktop) */}
            {filterPeriod === "custom" && customDateRange && (
              <p style={{ fontSize: "12px", color: colors.text.secondary, fontWeight: "500" }}>
                {formatDateRangeDisplay(customDateRange)}
              </p>
            )}
          </div>

          {/* Premium Minimal Modal / Bottom Sheet */}
          {showModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                display: "flex",
                alignItems: isMobile ? "flex-end" : "center",
                justifyContent: "center",
                zIndex: 1000,
                animation: "fadeIn 0.16s ease",
                backdropFilter: "blur(2px)",
              }}
              onClick={() => setShowModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: isMobile ? "24px 24px 0 0" : "16px",
                  padding: isMobile ? "24px 20px 32px" : "28px",
                  width: isMobile ? "100%" : "540px",
                  maxHeight: isMobile ? "85vh" : "auto",
                  boxShadow: isMobile 
                    ? "0 -2px 20px rgba(0, 0, 0, 0.1)" 
                    : "0 8px 32px rgba(0, 0, 0, 0.12)",
                  animation: isMobile 
                    ? "slideUp 0.18s cubic-bezier(0.2, 0, 0.38, 0.9)" 
                    : "fadeDown 0.18s cubic-bezier(0.2, 0, 0.38, 0.9)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  overflowY: "auto",
                }}
              >
                {/* Header */}
                <div>
                  <h3 style={{ fontSize: "24px", fontWeight: "600", color: colors.text.primary, marginBottom: "6px" }}>
                    Select period
                  </h3>
                  <p style={{ fontSize: "14px", color: colors.text.secondary, fontWeight: "400", lineHeight: "1.5" }}>
                    {t("dashboard.selectPeriodSub")}
                  </p>
                </div>

                {/* Preset Chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.3px", opacity: 0.7 }}>
                    Quick ranges
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: "10px" }}>
                    {[
                      { label: t("dashboard.last7days"), type: "last7" as const, icon: "clock" },
                      { label: t("dashboard.last30days"), type: "last30" as const, icon: "calendar" },
                      { label: t("dashboard.thisMonth"), type: "thisMonth" as const, icon: "calendar" },
                    ].map((option) => {
                      const isSelected = tempDateRange && formatDateRangeDisplay(tempDateRange) === formatDateRangeDisplay(getQuickRange(option.type));
                      return (
                        <button
                          key={option.type}
                          onClick={() => {
                            setTempDateRange(getQuickRange(option.type));
                          }}
                          style={{
                            padding: "10px 14px",
                            backgroundColor: isSelected ? `rgba(30, 58, 95, 0.08)` : "transparent",
                            border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "500",
                            color: isSelected ? colors.primary : colors.text.primary,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                            }
                          }}
                        >
                          {option.icon === "clock" && <ClockIcon size={16} color={isSelected ? colors.primary : colors.text.primary} strokeWidth={2} />}
                          {option.icon === "calendar" && <CalendarIcon size={16} color={isSelected ? colors.primary : colors.text.primary} strokeWidth={2} />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: "1px", backgroundColor: colors.border, opacity: 0.5 }} />

                {/* Custom Date Range */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.3px", opacity: 0.7 }}>
                    {t("dashboard.customRange")}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                    {/* Start Date */}
                    <div
                      style={{
                        padding: "12px 14px",
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = colors.primary;
                        (e.currentTarget as HTMLElement).style.backgroundColor = `rgba(30, 58, 95, 0.04)`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                        (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                      }}
                    >
                      <p style={{ fontSize: "11px", fontWeight: "600", color: colors.text.secondary }}>
                        {t("dashboard.from")}
                      </p>
                      <input
                        type="date"
                        value={tempDateRange?.start || ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setTempDateRange({
                              start: e.target.value,
                              end: tempDateRange?.end || "",
                            });
                          }
                        }}
                        style={{
                          fontSize: "15px",
                          fontWeight: "500",
                          color: colors.text.primary,
                          backgroundColor: "transparent",
                          border: "none",
                          outline: "none",
                          cursor: "pointer",
                          width: "100%",
                          padding: 0,
                        }}
                      />
                    </div>

                    {/* End Date */}
                    <div
                      style={{
                        padding: "12px 14px",
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = colors.primary;
                        (e.currentTarget as HTMLElement).style.backgroundColor = `rgba(30, 58, 95, 0.04)`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                        (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                      }}
                    >
                      <p style={{ fontSize: "11px", fontWeight: "600", color: colors.text.secondary }}>
                        {t("dashboard.to")}
                      </p>
                      <input
                        type="date"
                        value={tempDateRange?.end || ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setTempDateRange({
                              start: tempDateRange?.start || "",
                              end: e.target.value,
                            });
                          }
                        }}
                        style={{
                          fontSize: "15px",
                          fontWeight: "500",
                          color: colors.text.primary,
                          backgroundColor: "transparent",
                          border: "none",
                          outline: "none",
                          cursor: "pointer",
                          width: "100%",
                          padding: 0,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div style={{ display: "flex", gap: "12px", justifyContent: isMobile ? "stretch" : "flex-end", marginTop: "12px" }}>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: "11px 20px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: colors.text.primary,
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      borderRadius: "10px",
                      flex: isMobile ? 1 : "auto",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }}
                  >
                    {t("dashboard.cancel")}
                  </button>
                  <button
                    onClick={() => {
                      if (tempDateRange) {
                        setCustomDateRange(tempDateRange);
                        setFilterPeriod("custom");
                        setShowModal(false);
                      }
                    }}
                    style={{
                      padding: "11px 24px",
                      backgroundColor: colors.primary,
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: `0 2px 8px rgba(30, 58, 95, 0.15)`,
                      flex: isMobile ? 1 : "auto",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px rgba(30, 58, 95, 0.2)`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px rgba(30, 58, 95, 0.15)`;
                    }}
                  >
                    {t("dashboard.apply")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CSS Animations - Premium */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes fadeDown {
              from { opacity: 0; transform: translateY(-16px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
          {householdTransactions.map((ht) => {
            const filteredTransactions = filterTransactionsByDateRange(ht.transactions);
            
            // Sum of unique expenses on the filtered period
            const uniqueExpenseAmounts = new Map<string, number>();
            filteredTransactions.forEach((t) => {
              if (!uniqueExpenseAmounts.has(t.expenseId)) {
                uniqueExpenseAmounts.set(t.expenseId, t.expenseAmount);
              }
            });
            const totalSpentPeriod = Array.from(uniqueExpenseAmounts.values()).reduce((sum, amount) => sum + amount, 0);
            
            // You paid and you owe on the filtered period
            const householdTotalPaid = filteredTransactions.filter((t) => t.type === "paid").reduce((s, t) => s + t.amount, 0);
            const householdTotalOwed = filteredTransactions.filter((t) => t.type === "owed").reduce((s, t) => s + t.amount, 0);
            
            // Count unique expenses in the filtered period
            const uniqueExpenseIds = new Set(filteredTransactions.map((t) => t.expenseId));
            const transactionCount = uniqueExpenseIds.size;
            
            return (
              <PremiumCard key={ht.householdId}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.lg }}>
                  {ht.householdName}
                </h2>

                {/* Period Summary Per Household */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: spacing.md, marginBottom: "32px", paddingBottom: "32px", borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.sm }}>
                      {t("dashboard.totalSpent")}
                    </p>
                    <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "700", color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      €{totalSpentPeriod.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.sm }}>
                      {t("dashboard.yourShare")}
                    </p>
                    <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "700", color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      €{householdTotalOwed.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.sm }}>
                      {t("dashboard.transactions")}
                    </p>
                    <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "700", color: colors.text.primary }}>
                      {transactionCount}
                    </p>
                  </div>
                </div>

                {/* Balance Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md, marginBottom: "32px", paddingBottom: "32px", borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("dashboard.youPaid")}
                    </p>
                    <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "700", color: colors.success, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      €{householdTotalPaid.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, overflow: "hidden" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("dashboard.youOwe")}
                    </p>
                    <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "700", color: colors.danger, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      €{householdTotalOwed.toFixed(2)}
                    </p>
                  </div>
                </div>

              {filteredTransactions.length === 0 ? (
                <p style={{ color: colors.text.secondary, textAlign: "center", padding: `${spacing.xl} 0` }}>
                  {t("dashboard.noTransactions")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                  {filterPeriod === "allTime" ? (
                    // Monthly Bar Chart for All Time
                    <>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.lg }}>
                        {t("dashboard.activityOverTime")}
                      </p>
                      <MonthlyBarChart monthlyData={aggregateExpensesByMonth(ht.transactions)} />
                    </>
                  ) : (
                    // Timeline for other periods
                    <>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.lg }}>
                        {t("dashboard.activityTimeline")}
                      </p>

                      {/* Group by date */}
                      {(() => {
                        const grouped = new Map<string, Transaction[]>();
                        [...filteredTransactions]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .forEach((t) => {
                            const dateKey = new Date(t.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                            if (!grouped.has(dateKey)) grouped.set(dateKey, []);
                            grouped.get(dateKey)!.push(t);
                          });
                        
                        return Array.from(grouped.entries()).map(([dateKey, transactions]) => (
                          <div key={dateKey} style={{ marginBottom: "24px" }}>
                            <p style={{ fontSize: "11px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.md }}>
                              {dateKey}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {transactions.map((transaction, idx) => (
                                <div key={transaction.id}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: `${spacing.md} 0`,
                                      transition: "background-color 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                                      (e.currentTarget as HTMLElement).style.borderRadius = "8px";
                                      (e.currentTarget as HTMLElement).style.paddingLeft = spacing.md;
                                      (e.currentTarget as HTMLElement).style.paddingRight = spacing.md;
                                    }}
                                    onMouseLeave={(e) => {
                                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                                      (e.currentTarget as HTMLElement).style.paddingLeft = "0px";
                                      (e.currentTarget as HTMLElement).style.paddingRight = "0px";
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                      <p style={{ fontWeight: "600", color: colors.text.primary, marginBottom: spacing.xs, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {transaction.description}
                                      </p>
                                      <p style={{ fontSize: "11px", color: colors.text.secondary, textTransform: "capitalize" }}>
                                        {transaction.type === "paid" ? t("dashboard.youPaid") : t("dashboard.youOwe")}
                                      </p>
                                    </div>
                                    <p
                                      style={{
                                        fontWeight: "700",
                                        color: transaction.type === "paid" ? colors.success : colors.danger,
                                        fontSize: "15px",
                                        whiteSpace: "nowrap",
                                        marginLeft: spacing.lg,
                                      }}
                                    >
                                      {transaction.type === "paid" ? "+" : "-"}€{transaction.amount.toFixed(2)}
                                    </p>
                                  </div>
                                  {idx < transactions.length - 1 && (
                                    <div style={{ height: "1px", backgroundColor: colors.border, marginTop: spacing.sm }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </>
                  )}
                </div>
              )}

              <div style={{ marginTop: spacing.lg, display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
                <ActionButton
                  label={t("dashboard.viewExpenses")}
                  onClick={() => router.push("/expenses")}
                  size="small"
                  variant="secondary"
                />
                <ActionButton
                  label={t("dashboard.viewHousehold")}
                  onClick={() => router.push(`/households/${ht.householdId}`)}
                  size="small"
                />
              </div>
            </PremiumCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
