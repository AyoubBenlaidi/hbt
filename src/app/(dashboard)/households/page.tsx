"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard } from "@/components/ui/PremiumComponents";
import { colors, spacing } from "@/lib/designSystem";
import { normalizeCode, generateJoinCode } from "@/lib/joinCode";
import { useTranslations } from "@/hooks/useI18n";

interface Household {
  id: string;
  name: string;
  created_by_user_id: string;
  member_count?: number;
  totalPaid?: number;
  totalOwed?: number;
  balance?: number;
}

interface PendingRequest {
  id: string;
  household_id: string;
  status: string;
  created_at: string;
  household_name?: string;
}

export default function HouseholdsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdName, setHouseholdName] = useState("");

  // Join by code state
  const [joinCode, setJoinCode] = useState("");
  const { t } = useTranslations();
  const [isJoining, setIsJoining] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch households + pending requests
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setHouseholdsLoading(true);

        // Get all household_members for this user
        const { data: memberData, error: memberErr } = await supabase
          .from("household_members")
          .select("id, household_id")
          .eq("user_id", user.id);

        if (memberErr) throw memberErr;

        const householdIds = memberData?.map((m) => m.household_id) || [];

        if (householdIds.length === 0) {
          setHouseholds([]);
        } else {
          // Get all households with those IDs
          const { data, error: err } = await supabase
            .from("households")
            .select("id, name, created_by_user_id")
            .in("id", householdIds);

          if (err) throw err;

          // Calculate balances for each household
          const householdsWithBalance = await Promise.all(
            (data || []).map(async (household) => {
              const userMember = memberData?.find(
                (m) => m.household_id === household.id
              );

              if (!userMember) {
                return { ...household, totalPaid: 0, totalOwed: 0, balance: 0 };
              }

              const { data: expenses, error: expensesError } = await supabase
                .from("expenses")
                .select("id, household_id, deleted_at")
                .eq("household_id", household.id)
                .is("deleted_at", null);

              if (expensesError) throw expensesError;

              const expenseIds = (expenses || []).map((e) => e.id);

              let totalPaid = 0;
              let totalOwed = 0;

              if (expenseIds.length > 0) {
                const { data: payerData, error: payerError } = await supabase
                  .from("expense_payers")
                  .select("amount")
                  .eq("member_id", userMember.id)
                  .in("expense_id", expenseIds);

                if (payerError) throw payerError;
                totalPaid = (payerData || []).reduce(
                  (sum, p) => sum + parseFloat(p.amount as any),
                  0
                );

                const { data: splitData, error: splitError } = await supabase
                  .from("expense_splits")
                  .select("amount")
                  .eq("member_id", userMember.id)
                  .in("expense_id", expenseIds);

                if (splitError) throw splitError;
                totalOwed = (splitData || []).reduce(
                  (sum, s) => sum + parseFloat(s.amount as any),
                  0
                );
              }

              return { ...household, totalPaid, totalOwed, balance: totalPaid - totalOwed };
            })
          );

          setHouseholds(householdsWithBalance);
        }

        // Fetch user's pending join requests
        const { data: requests } = await supabase
          .from("household_join_requests")
          .select("id, household_id, status, created_at")
          .eq("requester_user_id", user.id)
          .eq("status", "pending");

        if (requests && requests.length > 0) {
          // Fetch household names for pending requests
          const reqHouseholdIds = requests.map((r) => r.household_id);
          const { data: reqHouseholds } = await supabase
            .from("households")
            .select("id, name")
            .in("id", reqHouseholdIds);

          const enriched = requests.map((r) => ({
            ...r,
            household_name: reqHouseholds?.find((h) => h.id === r.household_id)?.name || "Unknown",
          }));
          setPendingRequests(enriched);
        } else {
          setPendingRequests([]);
        }
      } catch (err) {
        console.error("Error fetching households:", err);
        addToast("Failed to load households", "error", 2000);
      } finally {
        setHouseholdsLoading(false);
      }
    };

    fetchData();
  }, [user, addToast]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!householdName.trim()) {
      addToast("Please enter a household name", "error", 2000);
      return;
    }

    if (!user) {
      addToast("User not authenticated", "error", 2000);
      return;
    }

    setLoading(true);
    try {
      const newCode = generateJoinCode();

      const { data: householdData, error: householdError } = await supabase
        .from("households")
        .insert({
          name: householdName,
          created_by_user_id: user.id,
          join_code: newCode,
          join_code_enabled: true,
        })
        .select()
        .single();

      if (householdError) throw householdError;

      const { error: memberError } = await supabase
        .from("household_members")
        .insert({
          household_id: householdData.id,
          user_id: user.id,
          role: "owner",
          status: "active",
        });

      if (memberError) throw memberError;

      setHouseholds([...households, householdData]);
      setHouseholdName("");
      addToast("Household created successfully!", "success", 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create household";
      addToast(message, "error", 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!user) return;

    const normalized = normalizeCode(joinCode);
    if (normalized.length < 4) {
      addToast("Please enter a valid join code", "error", 2000);
      return;
    }

    setIsJoining(true);
    try {
      // 1. Find household by code
      const { data: household, error: hErr } = await supabase
        .from("households")
        .select("id, name, join_code_enabled")
        .eq("join_code", normalized)
        .single();

      if (hErr || !household) {
        addToast("This code is invalid or no longer active", "error", 3000);
        return;
      }

      if (!household.join_code_enabled) {
        addToast("This code is currently paused by the household owner", "error", 3000);
        return;
      }

      // 2. Check if already a member
      const { data: existingMember } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", household.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        addToast("You are already a member of this household", "info", 3000);
        return;
      }

      // 3. Check if pending request already exists
      const { data: existingRequest } = await supabase
        .from("household_join_requests")
        .select("id")
        .eq("household_id", household.id)
        .eq("requester_user_id", user.id)
        .eq("status", "pending")
        .single();

      if (existingRequest) {
        addToast("Your request is already pending approval", "info", 3000);
        return;
      }

      // 4. Create join request
      const { error: insertErr } = await supabase
        .from("household_join_requests")
        .insert({
          household_id: household.id,
          requester_user_id: user.id,
          code_used: normalized,
          status: "pending",
        });

      if (insertErr) throw insertErr;

      setJoinCode("");
      addToast(`Request sent to "${household.name}" — waiting for owner approval`, "success", 4000);

      // Refresh pending requests
      setPendingRequests((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          household_id: household.id,
          status: "pending",
          created_at: new Date().toISOString(),
          household_name: household.name,
        },
      ]);
    } catch (err) {
      console.error("Error joining by code:", err);
      addToast("Failed to send join request", "error", 2000);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("household_join_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);

      if (error) throw error;

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      addToast("Request cancelled", "success", 2000);
    } catch (err) {
      console.error("Error cancelling request:", err);
      addToast("Failed to cancel request", "error", 2000);
    }
  };

  if (authLoading || householdsLoading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>Loading...</div>;
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ paddingBottom: "100px", width: "100%", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: "32px", fontWeight: "700", marginBottom: spacing.lg }}>{t("households.title")}</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: spacing.lg,
          width: "100%",
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            .households-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>

        <div className="households-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: spacing.lg }}>
          {/* Create New Household */}
          <PremiumCard>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: spacing.md }}>{t("households.createNew")}</h2>

            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              <div>
                <label
                  htmlFor="name"
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: colors.text.primary,
                    marginBottom: spacing.xs,
                    display: "block",
                  }}
                >
                  {t("households.householdName")}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder={t("households.namePlaceholder")}
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: spacing.md,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: `${spacing.md} ${spacing.lg}`,
                  backgroundColor: loading ? "#B3D9FF" : colors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  opacity: loading ? 0.6 : 1,
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.opacity = "0.9";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.opacity = "1";
                  }
                }}
              >
                {loading ? t("households.creating") : t("households.create")}
              </button>
            </form>
          </PremiumCard>

          {/* Join with Code */}
          <PremiumCard>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: spacing.sm }}>{t("households.joinHousehold")}</h2>
            <p style={{ fontSize: "13px", color: colors.text.secondary, marginBottom: spacing.md }}>
              {t("households.joinDescription")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <input
                type="text"
                placeholder={t("households.codePlaceholder")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={10}
                style={{
                  width: "100%",
                  padding: spacing.md,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  fontSize: "18px",
                  fontWeight: "600",
                  fontFamily: "monospace",
                  textAlign: "center",
                  letterSpacing: "3px",
                  boxSizing: "border-box",
                  color: colors.text.primary,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primary}15`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                onClick={handleJoinByCode}
                disabled={isJoining || !joinCode.trim()}
                style={{
                  padding: `${spacing.md} ${spacing.lg}`,
                  backgroundColor: isJoining || !joinCode.trim() ? colors.border : colors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: isJoining || !joinCode.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  width: "100%",
                }}
              >
                {isJoining ? t("households.sendingRequest") : t("households.requestAccess")}
              </button>
            </div>

            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div style={{ marginTop: spacing.lg, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: spacing.sm }}>
                  {t("households.pendingRequests")}
                </p>
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: `${spacing.sm} 0`,
                      gap: spacing.sm,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: "14px", fontWeight: "500", color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {req.household_name}
                      </p>
                      <p style={{ fontSize: "11px", color: colors.text.muted }}>
                        Requested {timeAgo(req.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(req.id)}
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        color: colors.danger,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        padding: `${spacing.xs} ${spacing.sm}`,
                      }}
                    >
                      {t("households.cancel")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </PremiumCard>

          {/* Your Households */}
          <PremiumCard>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: spacing.md,
              }}
            >
              {t("households.yourHouseholds")} ({households.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {households.length > 0 ? (
                households.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => router.push(`/households/${h.id}`)}
                    style={{
                      padding: spacing.md,
                      border: `1px solid #E5E7EB`,
                      borderRadius: "8px",
                      background: "white",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.background;
                      e.currentTarget.style.borderColor = colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.borderColor = colors.border;
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: spacing.sm,
                        gap: spacing.md,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "150px" }}>
                        <p
                          style={{
                            fontWeight: "600",
                            color: colors.text.primary,
                            fontSize: "14px",
                            marginBottom: spacing.xs,
                          }}
                        >
                          {h.name}
                        </p>
                        <p style={{ fontSize: "12px", color: colors.text.secondary }}>
                          {h.created_by_user_id === user?.id ? t("households.owner") : t("households.member")}
                        </p>
                      </div>
                      <p
                        style={{
                          fontWeight: "600",
                          fontSize: "16px",
                          color:
                            h.balance && h.balance > 0
                              ? colors.success
                              : h.balance && h.balance < 0
                              ? colors.danger
                              : colors.text.secondary,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.balance && h.balance > 0 ? "+" : ""}€{(h.balance || 0).toFixed(2)}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: spacing.md,
                        fontSize: "12px",
                        paddingTop: spacing.sm,
                        borderTop: `1px solid ${colors.border}`,
                        width: "100%",
                      }}
                    >
                      <div>
                        <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("households.paid")}:</p>
                        <p style={{ fontWeight: "600", color: colors.success }}>
                          €{(h.totalPaid || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("households.owed")}:</p>
                        <p style={{ fontWeight: "600", color: colors.danger }}>
                          €{(h.totalOwed || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p style={{ fontSize: "14px", color: colors.text.secondary, textAlign: "center", padding: spacing.lg }}>
                  {t("households.noHouseholdsYet")}
                </p>
              )}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
