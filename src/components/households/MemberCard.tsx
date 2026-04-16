"use client";

import React from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar } from "@/components/profile/Avatar";
import { TrashIcon } from "@/components/icons/NavigationIcons";
import { colors, spacing, transitions } from "@/lib/designSystem";

interface MemberCardProps {
  member: {
    id: string;
    user_id: string;
    role: string;
    status: string;
    joined_at: string;
    users?: {
      id: string;
      email: string;
      display_name: string;
    };
  };
  isCurrentUser: boolean;
  isOwner: boolean;
  onRemove: (memberId: string) => void;
}

export function MemberCard({ member, isCurrentUser, isOwner, onRemove }: React.PropsWithoutRef<MemberCardProps>) {
  const { profile } = useUserProfile(member.user_id);

  return (
    <div
      style={{
        padding: spacing.md,
        borderRadius: "12px",
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: spacing.md,
        transition: transitions.fast,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = colors.primary;
        (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = colors.border;
        (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
      }}
    >
      {/* Avatar + Info */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, flex: 1, minWidth: 0 }}>
        {profile && <Avatar user={profile} size="md" />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: "600", color: colors.text.primary, marginBottom: spacing.xs, fontSize: "14px" }}>
            {profile?.pseudo || member.users?.display_name || "Unknown"}
          </p>
          {profile?.description && (
            <p style={{ fontSize: "12px", color: colors.text.secondary, marginBottom: spacing.xs }}>
              {profile.description}
            </p>
          )}
          <p style={{ fontSize: "12px", color: colors.text.secondary }}>
            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            {isCurrentUser && " • You"}
          </p>
        </div>
      </div>

      {/* Remove Button */}
      {isOwner && !isCurrentUser && (
        <button
          onClick={() => onRemove(member.id)}
          style={{
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            padding: spacing.sm,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            transition: transitions.fast,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#fee2e2";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }}
        >
          <TrashIcon size={20} color={colors.danger} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
