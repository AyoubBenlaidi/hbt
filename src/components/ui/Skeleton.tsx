"use client";

import React from "react";
import { spacing, colors } from "@/lib/designSystem";

export const Skeleton: React.FC<{
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = "16px", borderRadius = "4px", style }) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      backgroundColor: colors.border,
      animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      ...style,
    }}
  />
);

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        <Skeleton height="20px" width="60%" />
        <Skeleton height="14px" width="100%" />
        <Skeleton height="14px" width="85%" />
      </div>
    ))}
  </div>
);

export const SkeletonBalanceCard: React.FC = () => (
  <div
    style={{
      borderRadius: "12px",
      padding: spacing.lg,
      backgroundColor: colors.background,
      display: "flex",
      flexDirection: "column",
      gap: spacing.md,
    }}
  >
    <Skeleton height="12px" width="40%" />
    <Skeleton height="32px" width="60%" />
    <Skeleton height="12px" width="50%" />
  </div>
);

// Inline skeleton for list items
export const SkeletonListItem: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: `${spacing.md} 0`,
      borderBottom: `1px solid ${colors.border}`,
    }}
  >
    <div style={{ flex: 1 }}>
      <Skeleton height="14px" width="70%" style={{ marginBottom: spacing.xs }} />
      <Skeleton height="12px" width="50%" />
    </div>
    <Skeleton height="20px" width="80px" />
  </div>
);
