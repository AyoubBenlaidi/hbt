"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslations } from "@/hooks/useI18n";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { spacing, colors } from "@/lib/designSystem";

interface Transaction {
  id: string;
  type: "paid" | "owed";
  description: string;
  amount: number;
  date: string;
}

interface HouseholdData {
  householdId: string;
  householdName: string;
  transactions: Transaction[];
  totalPaid: number;
  totalOwed: number;
  balance: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { t } = useTranslations();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  const [householdData, setHouseholdData] = useState<HouseholdData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: memberData } = await supabase
          .from("household_members")
          .select("id, household_id")
          .eq("user_id", user.id)
          .eq("status", "active");

        const householdIds = memberData?.map((m) => m.household_id) || [];

        if (householdIds.length === 0) {
          setHouseholdData([]);
          setLoading(false);
          return;
        }

        const { data: households } = await supabase
          .from("households")
          .select("id, name")
          .in("id", householdIds);

        const allData: HouseholdData[] = [];

        for (const household of households || []) {
          const userMember = memberData?.find((m) => m.household_id === household.id);
          if (!userMember) continue;

          const { data: payers } = await supabase
            .from("expense_payers")
            .select("amount, expenses(description, expense_date, household_id, deleted_at)")
            .eq("member_id", userMember.id);

          const { data: splits } = await supabase
            .from("expense_splits")
            .select("amount, expenses(description, expense_date, household_id, deleted_at)")
            .eq("member_id", userMember.id);

          const transactions: Transaction[] = [];
          let totalPaid = 0;
          let totalOwed = 0;

          (payers || []).forEach((p: any) => {
            if (p.expenses?.household_id === household.id && !p.expenses?.deleted_at) {
              const amount = parseFloat(p.amount);
              totalPaid += amount;
              transactions.push({
                id: p.id || Math.random().toString(),
                type: "paid",
                description: p.expenses.description,
                amount,
                date: p.expenses.expense_date,
              });
            }
          });

          (splits || []).forEach((s: any) => {
            if (s.expenses?.household_id === household.id && !s.expenses?.deleted_at) {
              const amount = parseFloat(s.amount);
              totalOwed += amount;
              transactions.push({
                id: s.id || Math.random().toString(),
                type: "owed",
                description: s.expenses.description,
                amount,
                date: s.expenses.expense_date,
              });
            }
          });

          transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          allData.push({
            householdId: household.id,
            householdName: household.name,
            transactions,
            totalPaid,
            totalOwed,
            balance: totalPaid - totalOwed,
          });
        }

        setHouseholdData(allData);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>{t('common.loading')}</div>;
  }

  const globalBalance = {
    totalPaid: householdData.reduce((sum, h) => sum + h.totalPaid, 0),
    totalOwed: householdData.reduce((sum, h) => sum + h.totalOwed, 0),
  };
  const netBalance = globalBalance.totalPaid - globalBalance.totalOwed;

  return (
    <div style={{ paddingBottom: "100px", width: "100%", boxSizing: "border-box" }}>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: "700",
          marginBottom: spacing.md,
        }}
      >
        {t('dashboard.title')}
      </h1>

      {householdData.length === 0 ? (
        <PremiumCard>
          <div style={{ textAlign: "center", padding: spacing.xl }}>
            <ActionButton label="Add Expense" onClick={() => router.push("/expenses")} />
          </div>
        </PremiumCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {/* Global Balance Hero Block */}
          <PremiumCard elevated interactive>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isLargeScreen ? "1fr 1fr 1fr" : isMediumScreen ? "1fr 1fr" : "1fr",
                gap: isMediumScreen ? spacing.lg : spacing.md,
                width: "100%",
                minWidth: 0,
              }}
            >
              {/* Net Balance */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: 0 }}>
                <p style={{ fontSize: isLargeScreen ? "12px" : "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t('dashboard.netBalance')}
                </p>
                <p
                  style={{
                    fontSize: isLargeScreen ? "32px" : isMediumScreen ? "28px" : "18px",
                    fontWeight: "700",
                    color: netBalance > 0 ? colors.success : netBalance < 0 ? colors.danger : colors.text.primary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word",
                  }}
                >
                  {netBalance > 0 ? "+" : ""}{netBalance.toFixed(2)}€
                </p>
              </div>

              {/* You Owe */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: 0 }}>
                <p style={{ fontSize: isLargeScreen ? "12px" : "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t('dashboard.youOwe')}
                </p>
                <p style={{ fontSize: isLargeScreen ? "32px" : isMediumScreen ? "28px" : "18px", fontWeight: "700", color: colors.danger, overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word" }}>
                  -{globalBalance.totalOwed.toFixed(2)}€
                </p>
              </div>

              {/* You Are Owed */}
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: 0 }}>
                <p style={{ fontSize: isLargeScreen ? "12px" : "10px", fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t('dashboard.youAreOwed')}
                </p>
                <p style={{ fontSize: isLargeScreen ? "32px" : isMediumScreen ? "28px" : "18px", fontWeight: "700", color: colors.success, overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word" }}>
                  +{globalBalance.totalPaid.toFixed(2)}€
                </p>
              </div>
            </div>
          </PremiumCard>

          {/* Household Cards Grid */}
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: spacing.md }}>{t('dashboard.households')}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, width: "100%" }}>
            {householdData.map((hd) => (
              <PremiumCard key={hd.householdId} interactive onClick={() => router.push(`/households/${hd.householdId}`)}>
                <h2 style={{ fontSize: isMediumScreen ? "18px" : "16px", fontWeight: "600", marginBottom: spacing.lg, wordBreak: "break-word" }}>
                  {hd.householdName}
                </h2>

                {hd.transactions.length === 0 ? (
                  <p style={{ color: colors.text.secondary }}>{t('dashboard.noTransactions')}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, width: "100%" }}>
                    {hd.transactions.filter((t) => t.type === "paid").length > 0 && (
                      <div>
                        <p
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: colors.success,
                            marginBottom: spacing.sm,
                          }}
                        >
                          {t('dashboard.paid')}
                        </p>
                        {hd.transactions
                          .filter((t) => t.type === "paid")
                          .slice(0, 2)
                          .map((t) => (
                            <div
                              key={t.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: isMediumScreen ? "14px" : "12px",
                                marginBottom: spacing.xs,
                                gap: spacing.sm,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                {t.description}
                              </span>
                              <span
                                style={{
                                  color: colors.success,
                                  fontWeight: "600",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                €{t.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                    {hd.transactions.filter((t) => t.type === "owed").length > 0 && (
                      <div>
                        <p
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: colors.danger,
                            marginBottom: spacing.sm,
                          }}
                        >
                          {t('dashboard.owed')}
                        </p>
                        {hd.transactions
                          .filter((t) => t.type === "owed")
                          .slice(0, 2)
                          .map((t) => (
                            <div
                              key={t.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: isMediumScreen ? "14px" : "12px",
                                marginBottom: spacing.xs,
                                gap: spacing.sm,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                {t.description}
                              </span>
                              <span
                                style={{
                                  color: colors.danger,
                                  fontWeight: "600",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                €{t.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </PremiumCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
