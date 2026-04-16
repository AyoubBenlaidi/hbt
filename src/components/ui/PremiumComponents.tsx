"use client";

import React from "react";
import { colors, spacing, transitions, shadows } from "@/lib/designSystem";

interface PremiumCardProps {
  children: React.ReactNode;
  elevated?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  elevated = false,
  interactive = false,
  onClick,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: colors.card,
        borderRadius: "12px",
        padding: spacing.lg,
        border: `1px solid ${colors.border}`,
        boxShadow: isHovered && interactive ? shadows.lg : elevated ? shadows.md : shadows.sm,
        transform: isHovered && interactive ? "translateY(-2px)" : "translateY(0)",
        transition: `all ${transitions.normal}`,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      {children}
    </div>
  );
};

interface HeroBalanceCardProps {
  label: string;
  amount: number;
  type: "owed" | "owe" | "balanced";
  onClick?: () => void;
}

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  label,
  amount,
  type,
  onClick,
}) => {
  const bgColor =
    type === "owed"
      ? "rgba(107, 142, 94, 0.05)"
      : type === "owe"
      ? "rgba(168, 95, 95, 0.05)"
      : "rgba(30, 58, 95, 0.05)";

  const textColor =
    type === "owed" ? colors.success : type === "owe" ? colors.danger : colors.primary;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: bgColor,
        borderRadius: "12px",
        padding: spacing.lg,
        cursor: onClick ? "pointer" : "default",
        transition: transitions.normal,
        border: `2px solid ${textColor}30`,
        minWidth: "120px",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "scale(1.02)";
          e.currentTarget.style.boxShadow = shadows.md;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <p style={{ fontSize: "12px", fontWeight: "600", color: colors.text.secondary, marginBottom: "4px", wordBreak: "break-word" }}>
        {label}
      </p>
      <p style={{ fontSize: "28px", fontWeight: "700", color: textColor, wordBreak: "break-word" }}>
        €{amount.toFixed(2)}
      </p>
    </div>
  );
};

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onClick,
  variant = "primary",
  size = "medium",
  fullWidth = false,
  loading = false,
  disabled = false,
  style = {},
}) => {
  const backgroundColor =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
      ? colors.background
      : colors.danger;

  const textColor =
    variant === "secondary" ? colors.text.primary : "white";

  const borderColor = variant === "secondary" ? colors.border : "transparent";

  const padding =
    size === "small"
      ? `${spacing.sm} ${spacing.md}`
      : size === "medium"
      ? `${spacing.md} ${spacing.lg}`
      : `${spacing.lg} ${spacing.xl}`;

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        backgroundColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "8px",
        padding,
        fontSize: size === "large" ? "16px" : "14px",
        fontWeight: "600",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        transition: transitions.fast,
        width: fullWidth ? "100%" : "auto",
        opacity: loading || disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!loading && !disabled) {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.boxShadow = shadows.md;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {loading ? "Loading..." : label}
    </button>
  );
};
