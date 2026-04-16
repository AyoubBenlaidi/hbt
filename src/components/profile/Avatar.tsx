import React from "react";
import { UserProfile, getInitials } from "@/types/profile";

export interface AvatarProps {
  user?: UserProfile | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 40,
};

const FONT_SIZES = {
  xs: 8,
  sm: 10,
  md: 13,
  lg: 16,
};

export function Avatar({ user, size = "md", className = "" }: AvatarProps) {
  if (!user) {
    return (
      <div
        style={{
          width: SIZES[size],
          height: SIZES[size],
          borderRadius: "50%",
          backgroundColor: "#E8E3DD",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
        className={className}
      />
    );
  }

  const initials = getInitials(user.pseudo);

  return (
    <div
      style={{
        width: SIZES[size],
        height: SIZES[size],
        borderRadius: "50%",
        backgroundColor: user.avatarColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        border: `1px solid rgba(0, 0, 0, 0.05)`,
      }}
      className={className}
    >
      <p
        style={{
          fontSize: FONT_SIZES[size],
          fontWeight: 600,
          color: "#fff",
          margin: 0,
          letterSpacing: "-0.5px",
        }}
      >
        {initials}
      </p>
    </div>
  );
}
