"use client";

import React, { useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar } from "@/components/profile/Avatar";
import { TrashIcon, PencilIcon } from "@/components/icons/NavigationIcons";
import { colors, spacing } from "@/lib/designSystem";

interface ExpensePayer {
  amount: string;
  household_members?: {
    id: string;
    user_id: string;
  };
}

interface ExpenseItemProps {
  expense: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    expense_date: string;
    expense_kind: string;
    notes?: string;
    created_by_user_id: string;
    household_id: string;
    expense_payers?: ExpensePayer[];
  };
  onEdit: (expenseId: string) => void;
  onDelete: (expenseId: string) => void;
}

export function ExpenseItem({ expense, onEdit, onDelete }: ExpenseItemProps) {
  const payers = expense.expense_payers?.map((p) => ({
    user_id: p.household_members?.user_id,
    amount: p.amount,
  })) || [];

  // Get first payer for display
  const firstPayerId = payers[0]?.user_id;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center",
        gap: spacing.md,
        padding: `12px ${spacing.md}px`,
        minHeight: "56px",
        borderBottom: `1px solid #f0f0f0`,
        transition: "background-color 0.15s ease",
      }}
    >
      {/* LEFT: Title + Meta */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* Title */}
        <p
          style={{
            fontWeight: 600,
            fontSize: "14px",
            color: colors.text.primary,
            margin: "0 0 4px 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {expense.description}
        </p>

        {/* Meta: Date + First Payer Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: colors.text.secondary, fontWeight: 500 }}>
            {new Date(expense.expense_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span style={{ fontSize: "12px", color: colors.text.secondary }}>•</span>
          {firstPayerId && <PayerBadge userId={firstPayerId} />}
          {payers.length > 1 && (
            <span style={{ fontSize: "11px", color: colors.text.secondary, fontWeight: 500 }}>
              +{payers.length - 1}
            </span>
          )}
        </div>
      </div>

      {/* CENTER: Amount */}
      <div
        style={{
          textAlign: "right",
          fontWeight: 700,
          fontSize: "14px",
          color: colors.primary,
          whiteSpace: "nowrap",
          minWidth: "70px",
        }}
      >
        {expense.currency} {parseFloat(expense.amount as any).toFixed(2)}
      </div>

      {/* EDIT Button */}
      <button
        onClick={() => onEdit(expense.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          transition: "all 0.15s ease",
          color: colors.text.secondary,
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = colors.primary;
          (e.currentTarget as HTMLElement).style.backgroundColor = `${colors.primary}15`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = colors.text.secondary;
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }}
        title="Edit expense"
      >
        <PencilIcon size={16} color="currentColor" />
      </button>

      {/* DELETE Button */}
      <button
        onClick={() => {
          if (confirm("Delete this expense?")) {
            onDelete(expense.id);
          }
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          transition: "all 0.15s ease",
          color: colors.text.secondary,
          backgroundColor: "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = colors.danger;
          (e.currentTarget as HTMLElement).style.backgroundColor = "#fee2e2";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = colors.text.secondary;
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }}
        title="Delete expense"
      >
        <TrashIcon size={16} color="currentColor" strokeWidth={2} />
      </button>
    </div>
  );
}

// Compact payer badge with hover tooltip
function PayerBadge({ userId }: { userId?: string }) {
  const { profile } = useUserProfile(userId);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!profile) return null;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Avatar user={profile} size="xs" />
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: colors.text.primary,
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {profile.pseudo}
          <div
            style={{
              position: "absolute",
              bottom: "-4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: `4px solid ${colors.text.primary}`,
            }}
          />
        </div>
      )}
    </div>
  );
}
