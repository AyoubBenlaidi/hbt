// Design System - Colors, Spacing, Typography
// Philosophy: Calm, premium personal space for managing shared finances
// Warm neutrals + Deep navy + Terracotta accent + Muted financial signals

export const colors = {
  // Primary: Deep desaturated navy (trust, sophistication)
  primary: "#1E3A5F",
  
  // Accent: Terracotta (human warmth)
  accent: "#B85F3F",
  
  // Financial signals: Muted, never aggressive
  success: "#6B8E5E", // Muted green (you owe money)
  danger: "#A85F5F", // Muted red (you're owed money)
  
  // Background: Warm neutrals (home feeling)
  background: "#F5F1ED",
  card: "#FDFBF9",
  
  // Text: Warmer tones
  text: {
    primary: "#2C2416",
    secondary: "#6B6359",
    muted: "#9B8E7F",
  },
  
  // Borders: Warm gray
  border: "#E8E3DD",
  hover: "#F9F5F0",
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
};

export const typography = {
  title: {
    fontSize: "28px",
    fontWeight: "600",
    lineHeight: "1.2",
  },
  section: {
    fontSize: "18px",
    fontWeight: "500",
    lineHeight: "1.4",
  },
  body: {
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "1.5",
  },
  small: {
    fontSize: "14px",
    fontWeight: "400",
    lineHeight: "1.4",
  },
  micro: {
    fontSize: "12px",
    fontWeight: "400",
    lineHeight: "1.3",
    color: colors.text.muted,
  },
};

export const transitions = {
  fast: "150ms ease-out",
  normal: "200ms ease-out",
  slow: "300ms ease-out",
};

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
};
