"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { MemberCard } from "@/components/households/MemberCard";
import { colors, spacing, transitions } from "@/lib/designSystem";
import { generateJoinCode, formatCodeForDisplay } from "@/lib/joinCode";
import { useTranslations } from "@/hooks/useI18n";

interface Household {
  id: string;
  name: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  join_code: string;
  join_code_enabled: boolean;
}

interface HouseholdMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  users?: any;
}

interface JoinRequest {
  id: string;
  household_id: string;
  requester_user_id: string;
  code_used: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
  // Enriched
  requester_pseudo?: string;
  requester_avatar_color?: string;
}

export default function HouseholdDetailPage() {
  const router = useRouter();
  const params = useParams();
  const householdId = params.id as string;
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const { addToast } = useToast();
  const { t } = useTranslations();

  // Join code management state
  const [codeCopied, setCodeCopied] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTogglingCode, setIsTogglingCode] = useState(false);

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  const [reviewedRequests, setReviewedRequests] = useState<JoinRequest[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch household details
  useEffect(() => {
    if (!user || !householdId) return;

    const fetchHousehold = async () => {
      try {
        setLoading(true);

        const { data: householdData, error: householdError } = await supabase
          .from("households")
          .select("*")
          .eq("id", householdId)
          .single();

        if (householdError) throw householdError;
        setHousehold(householdData);
        setEditingName(householdData.name);
        const ownerFlag = householdData.created_by_user_id === user.id;
        setIsOwner(ownerFlag);

        const { data: membersData, error: membersError } = await supabase
          .from("household_members")
          .select(`
            id,
            user_id,
            role,
            status,
            joined_at,
            users (
              email,
              display_name
            )
          `)
          .eq("household_id", householdId);

        if (membersError) throw membersError;
        setMembers(membersData || []);

        // Fetch join requests if owner
        if (ownerFlag) {
          await fetchJoinRequests();
        }
      } catch (err) {
        console.error("Error fetching household:", err);
        addToast("Failed to load household", "error", 3000);
      } finally {
        setLoading(false);
      }
    };

    fetchHousehold();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, householdId]);

  const fetchJoinRequests = async () => {
    // Pending
    const { data: pending } = await supabase
      .from("household_join_requests")
      .select("*")
      .eq("household_id", householdId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // Reviewed (approved/rejected) — last 20
    const { data: reviewed } = await supabase
      .from("household_join_requests")
      .select("*")
      .eq("household_id", householdId)
      .in("status", ["approved", "rejected"])
      .order("reviewed_at", { ascending: false })
      .limit(20);

    // Enrich with profile data
    const allRequests = [...(pending || []), ...(reviewed || [])];
    const userIds = [...new Set(allRequests.map((r) => r.requester_user_id))];

    let profiles: Record<string, { pseudo: string; avatar_color: string }> = {};
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("id, pseudo, avatar_color")
        .in("id", userIds);

      if (profileData) {
        profileData.forEach((p: any) => {
          profiles[p.id] = { pseudo: p.pseudo, avatar_color: p.avatar_color };
        });
      }
    }

    const enrich = (r: any): JoinRequest => ({
      ...r,
      requester_pseudo: profiles[r.requester_user_id]?.pseudo || "Unknown user",
      requester_avatar_color: profiles[r.requester_user_id]?.avatar_color || "#9B8E7F",
    });

    setJoinRequests((pending || []).map(enrich));
    setReviewedRequests((reviewed || []).map(enrich));
  };

  const handleApproveRequest = async (request: JoinRequest) => {
    try {
      // Check if already member
      const { data: existing } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("user_id", request.requester_user_id)
        .single();

      if (existing) {
        // Already a member, just mark approved
        await supabase
          .from("household_join_requests")
          .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by_user_id: user?.id })
          .eq("id", request.id);

        setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
        addToast("User is already a member", "info", 2000);
        return;
      }

      // Add as member
      const { error: memberErr } = await supabase
        .from("household_members")
        .insert({
          household_id: householdId,
          user_id: request.requester_user_id,
          role: "member",
          status: "active",
        });

      if (memberErr) throw memberErr;

      // Mark request approved
      await supabase
        .from("household_join_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by_user_id: user?.id })
        .eq("id", request.id);

      // Refresh members
      const { data: updatedMembers } = await supabase
        .from("household_members")
        .select(`id, user_id, role, status, joined_at, users ( email, display_name )`)
        .eq("household_id", householdId);

      setMembers(updatedMembers || []);
      setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      addToast(`${request.requester_pseudo} joined the household`, "success", 3000);
    } catch (err) {
      console.error("Error approving request:", err);
      addToast("Failed to approve request", "error", 2000);
    }
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    try {
      await supabase
        .from("household_join_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by_user_id: user?.id })
        .eq("id", request.id);

      setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      addToast("Request declined", "success", 2000);
    } catch (err) {
      console.error("Error rejecting request:", err);
      addToast("Failed to decline request", "error", 2000);
    }
  };

  const handleCopyCode = async () => {
    if (!household?.join_code) return;
    try {
      await navigator.clipboard.writeText(formatCodeForDisplay(household.join_code));
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      addToast("Failed to copy code", "error", 2000);
    }
  };

  const handleRegenerateCode = async () => {
    if (!household) return;
    setIsRegenerating(true);
    try {
      const newCode = generateJoinCode();
      const { error } = await supabase
        .from("households")
        .update({ join_code: newCode, join_code_updated_at: new Date().toISOString() })
        .eq("id", householdId);

      if (error) throw error;

      setHousehold({ ...household, join_code: newCode });
      setShowRegenerateConfirm(false);
      addToast("Join code regenerated", "success", 2000);
    } catch (err) {
      console.error("Error regenerating code:", err);
      addToast("Failed to regenerate code", "error", 2000);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleCode = async () => {
    if (!household) return;
    setIsTogglingCode(true);
    try {
      const newEnabled = !household.join_code_enabled;
      const { error } = await supabase
        .from("households")
        .update({ join_code_enabled: newEnabled })
        .eq("id", householdId);

      if (error) throw error;

      setHousehold({ ...household, join_code_enabled: newEnabled });
      addToast(newEnabled ? "Join code enabled" : "Join code paused", "success", 2000);
    } catch (err) {
      console.error("Error toggling code:", err);
      addToast("Failed to update code status", "error", 2000);
    } finally {
      setIsTogglingCode(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      addToast("Please enter an email", "error", 2000);
      return;
    }
    if (!isOwner) {
      addToast("Only the household owner can invite members", "error", 2000);
      return;
    }

    setIsInviting(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", inviteEmail)
        .single();

      if (userError || !userData) {
        addToast(`User with email "${inviteEmail}" not found. They need to create an account first.`, "error", 3000);
        return;
      }

      const { data: existing } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("user_id", userData.id)
        .single();

      if (existing) {
        addToast("This user is already a member", "info", 2000);
        return;
      }

      const { error: insertError } = await supabase
        .from("household_members")
        .insert({
          household_id: householdId,
          user_id: userData.id,
          role: "member",
          status: "active",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: updatedMembers } = await supabase
        .from("household_members")
        .select(`id, user_id, role, status, joined_at, users ( email, display_name )`)
        .eq("household_id", householdId);

      setMembers(updatedMembers || []);
      setInviteEmail("");
      addToast("Member invited successfully!", "success", 3000);
    } catch (err) {
      console.error("Error inviting member:", err);
      addToast("Failed to invite member", "error", 2000);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isOwner) {
      addToast("Only the household owner can remove members", "error", 2000);
      return;
    }
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const { error: err } = await supabase
        .from("household_members")
        .delete()
        .eq("id", memberId);

      if (err) throw err;
      setMembers(members.filter((m) => m.id !== memberId));
      addToast("Member removed successfully", "success", 3000);
    } catch (err) {
      console.error("Error removing member:", err);
      addToast("Failed to remove member", "error", 2000);
    }
  };

  const handleSaveName = async () => {
    if (!editingName.trim()) {
      addToast("Household name cannot be empty", "error", 2000);
      return;
    }
    if (editingName === household?.name) {
      setIsEditMode(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error: err } = await supabase
        .from("households")
        .update({ name: editingName.trim() })
        .eq("id", householdId);

      if (err) throw err;
      setHousehold({ ...household!, name: editingName.trim() });
      setIsEditMode(false);
      addToast("Household name updated successfully", "success", 3000);
    } catch (err) {
      console.error("Error updating household name:", err);
      addToast("Failed to update household name", "error", 2000);
    } finally {
      setIsSavingName(false);
    }
  };

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

  if (authLoading || loading) {
    return <div style={{ paddingTop: spacing.xl, textAlign: "center" }}>Loading...</div>;
  }

  if (!household) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <PremiumCard>
          <div style={{ textAlign: "center", padding: spacing.xl }}>
            <p style={{ color: colors.text.secondary, marginBottom: spacing.md }}>{t("households.notFound")}</p>
            <ActionButton label={t("households.backToHouseholds")} onClick={() => router.push("/households")} />
          </div>
        </PremiumCard>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "100px", display: "flex", flexDirection: "column", gap: spacing.lg, width: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md, flexWrap: "wrap", width: "100%" }}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          {isEditMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                style={{
                  fontSize: isMediumScreen ? "32px" : "24px",
                  fontWeight: "700",
                  padding: spacing.md,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: "8px",
                  fontFamily: "inherit",
                  color: colors.text.primary,
                  boxSizing: "border-box",
                  width: "100%",
                }}
              />
              <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
                <ActionButton label={isSavingName ? t("households.saving") : t("households.save")} onClick={handleSaveName} disabled={isSavingName} size="small" />
                <ActionButton label={t("households.cancel")} onClick={() => { setIsEditMode(false); setEditingName(household?.name || ""); }} variant="secondary" size="small" />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: spacing.md, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ fontSize: isMediumScreen ? "32px" : "24px", fontWeight: "700", marginBottom: spacing.sm, wordBreak: "break-word" }}>{household.name}</h1>
                <p style={{ fontSize: "14px", color: colors.text.secondary, wordBreak: "break-word" }}>
                  {t("households.created")} {new Date(household.created_at).toLocaleDateString()}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setIsEditMode(true)}
                  style={{
                    backgroundColor: "transparent",
                    border: `1px solid ${colors.border}`,
                    color: colors.text.primary,
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "500",
                    transition: transitions.fast,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.background;
                    e.currentTarget.style.borderColor = colors.primary;
                    e.currentTarget.style.color = colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.color = colors.text.primary;
                  }}
                >
                  {t("households.edit")}
                </button>
              )}
            </div>
          )}
        </div>
        <ActionButton label={t("households.back")} onClick={() => router.push("/households")} variant="secondary" />
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMediumScreen ? "1fr 1fr" : "1fr", gap: spacing.lg, width: "100%", boxSizing: "border-box" }}>
        {/* Members List */}
        <PremiumCard>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
            {t("households.members")} ({members.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, width: "100%" }}>
            {members.length > 0 ? (
              members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  isCurrentUser={member.user_id === user?.id}
                  isOwner={isOwner}
                  onRemove={handleRemoveMember}
                />
              ))
            ) : (
              <p style={{ color: colors.text.secondary, fontSize: "14px" }}>{t("households.noMembers")}</p>
            )}
          </div>
        </PremiumCard>

        {/* Invite or Actions */}
        {isOwner && (
          <PremiumCard>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>{t("households.inviteMember")}</h2>
            <form
              onSubmit={handleInviteMember}
              style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: colors.text.primary }}>
                  {t("households.memberEmail")}
                </label>
                <input
                  type="email"
                  placeholder={t("households.emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  style={{
                    padding: spacing.md,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <ActionButton
                label={isInviting ? t("households.inviting") : t("households.invite")}
                onClick={() => handleInviteMember({} as React.FormEvent)}
                disabled={isInviting}
              />
            </form>
            <p style={{ fontSize: "12px", color: colors.text.secondary, marginTop: spacing.md }}>
              {t("households.userMustCreateAccount")}
            </p>
          </PremiumCard>
        )}

        {!isOwner && (
          <PremiumCard>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>{t("households.actions")}</h2>
            <ActionButton label={t("households.viewExpenses")} onClick={() => router.push("/expenses")} />
          </PremiumCard>
        )}
      </div>

      {/* ═══ OWNER ONLY: Join Code & Requests ═══ */}
      {isOwner && (
        <div style={{ display: "grid", gridTemplateColumns: isMediumScreen ? "1fr 1fr" : "1fr", gap: spacing.lg, width: "100%", boxSizing: "border-box" }}>
          {/* Join Code Card */}
          <PremiumCard>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.sm }}>{t("households.joinCode")}</h2>
            <p style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: spacing.lg }}>
              {t("households.joinCodeDescription")}
            </p>

            {/* Code display */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: `${spacing.lg} ${spacing.md}`,
                backgroundColor: household.join_code_enabled ? colors.background : `${colors.danger}10`,
                border: `2px solid ${household.join_code_enabled ? colors.border : `${colors.danger}30`}`,
                borderRadius: "12px",
                marginBottom: spacing.md,
                position: "relative",
              }}
            >
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  fontFamily: "monospace",
                  letterSpacing: "4px",
                  color: household.join_code_enabled ? colors.primary : colors.text.muted,
                  opacity: household.join_code_enabled ? 1 : 0.5,
                }}
              >
                {formatCodeForDisplay(household.join_code)}
              </p>
              {!household.join_code_enabled && (
                <span
                  style={{
                    position: "absolute",
                    top: spacing.sm,
                    right: spacing.sm,
                    fontSize: "10px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    color: colors.danger,
                    backgroundColor: `${colors.danger}15`,
                    padding: `2px ${spacing.sm}`,
                    borderRadius: "4px",
                  }}
                >
                  {t("households.paused")}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button
                onClick={handleCopyCode}
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  backgroundColor: codeCopied ? colors.success : colors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: "80px",
                }}
              >
                                {codeCopied ? t("households.copied") : t("households.copy")}
              </button>
              <button
                onClick={() => setShowRegenerateConfirm(true)}
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  backgroundColor: "transparent",
                  color: colors.text.primary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: "80px",
                }}
              >
                {t("households.regenerate")}
              </button>
              <button
                onClick={handleToggleCode}
                disabled={isTogglingCode}
                style={{
                  flex: 1,
                  padding: `${spacing.sm} ${spacing.md}`,
                  backgroundColor: "transparent",
                  color: household.join_code_enabled ? colors.danger : colors.success,
                  border: `1px solid ${household.join_code_enabled ? `${colors.danger}40` : `${colors.success}40`}`,
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: isTogglingCode ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  minWidth: "80px",
                }}
              >
                                {household.join_code_enabled ? t("households.pause") : t("households.enable")}
              </button>
            </div>

            {/* Regenerate confirmation dialog */}
            {showRegenerateConfirm && (
              <div
                style={{
                  marginTop: spacing.md,
                  padding: spacing.md,
                  backgroundColor: `${colors.accent}08`,
                  border: `1px solid ${colors.accent}30`,
                  borderRadius: "10px",
                }}
              >
                <p style={{ fontSize: "13px", fontWeight: "600", color: colors.text.primary, marginBottom: spacing.xs }}>
                  {t("households.regenerateConfirm")}
                </p>
                <p style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: spacing.md }}>
                  {t("households.regenerateWarning")}
                </p>
                <div style={{ display: "flex", gap: spacing.sm }}>
                  <button
                    onClick={() => setShowRegenerateConfirm(false)}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      backgroundColor: "transparent",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      color: colors.text.secondary,
                    }}
                  >
                    {t("households.cancel")}
                  </button>
                  <button
                    onClick={handleRegenerateCode}
                    disabled={isRegenerating}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      backgroundColor: colors.accent,
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: isRegenerating ? "not-allowed" : "pointer",
                    }}
                  >
                    {isRegenerating ? t("households.regenerating") : t("households.regenerate")}
                  </button>
                </div>
              </div>
            )}
          </PremiumCard>

          {/* Join Requests Card */}
          <PremiumCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600" }}>
                {t("households.joinRequests")}
                {joinRequests.length > 0 && (
                  <span
                    style={{
                      marginLeft: spacing.sm,
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "white",
                      backgroundColor: colors.accent,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      verticalAlign: "middle",
                    }}
                  >
                    {joinRequests.length}
                  </span>
                )}
              </h2>
            </div>

            {/* Pending requests */}
            {joinRequests.length === 0 ? (
              <div style={{ padding: `${spacing.lg} 0`, textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: colors.text.muted }}>
                  {t("households.noPendingRequests")}
                </p>
                <p style={{ fontSize: "11px", color: colors.text.muted, marginTop: spacing.xs }}>
                  {t("households.noPendingRequestsHint")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.md,
                      backgroundColor: colors.background,
                      borderRadius: "10px",
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: req.requester_avatar_color || colors.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "white" }}>
                        {(req.requester_pseudo || "?")[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {req.requester_pseudo}
                      </p>
                      <p style={{ fontSize: "11px", color: colors.text.muted }}>
                        {t("households.requested")} {timeAgo(req.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
                      <button
                        onClick={() => handleApproveRequest(req)}
                        style={{
                          padding: `${spacing.xs} ${spacing.sm}`,
                          backgroundColor: colors.success,
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        {t("households.approve")}
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req)}
                        style={{
                          padding: `${spacing.xs} ${spacing.sm}`,
                          backgroundColor: "transparent",
                          color: colors.text.muted,
                          border: `1px solid ${colors.border}`,
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        {t("households.decline")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reviewed toggle */}
            {reviewedRequests.length > 0 && (
              <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
                <button
                  onClick={() => setShowReviewed(!showReviewed)}
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: colors.text.muted,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                                    {showReviewed ? t("households.hideReviewed") : t("households.showReviewed")} ({reviewedRequests.length})
                </button>

                {showReviewed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginTop: spacing.sm }}>
                    {reviewedRequests.map((req) => (
                      <div key={req.id} style={{ display: "flex", alignItems: "center", gap: spacing.sm, padding: `${spacing.xs} 0` }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            backgroundColor: req.requester_avatar_color || colors.text.muted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: "10px", fontWeight: "700", color: "white" }}>
                            {(req.requester_pseudo || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: colors.text.secondary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {req.requester_pseudo}
                        </p>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "600",
                            color: req.status === "approved" ? colors.success : colors.danger,
                            textTransform: "capitalize",
                          }}
                        >
                                                    {req.status === "approved" ? t("households.approved") : t("households.declined")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </PremiumCard>
        </div>
      )}
    </div>
  );
}
