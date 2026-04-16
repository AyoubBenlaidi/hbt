"use client";

import React from "react";
import { useTranslations } from "@/hooks/useI18n";
import { colors, spacing } from "@/lib/designSystem";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslations();

  const toggleLanguage = () => {
    const newLocale = locale === "en" ? "fr" : "en";
    setLocale(newLocale);
    // Reload to ensure all components re-read from cache
    window.location.reload();
  };

  return (
    <button
      onClick={toggleLanguage}
      style={{
        padding: `${spacing.sm} ${spacing.md}`,
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: "6px",
        cursor: "pointer",
        color: colors.text.primary,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary;
        e.currentTarget.style.color = colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.color = colors.text.primary;
      }}
      title={`Switch to ${locale === "en" ? "Français" : "English"}`}
    >
      {locale === "en" ? "🇫🇷 FR" : "🇬🇧 EN"}
    </button>
  );
}
