"use client";

import React, { useState } from "react";
import { UserProfile, AVATAR_COLORS, getInitials } from "@/types/profile";
import { colors, spacing } from "@/lib/designSystem";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "@/hooks/useI18n";

export interface ProfileSheetProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSave: (updates: { pseudo: string; description: string; avatarColor: string }) => Promise<void>;
}

export function ProfileSheet({ isOpen, user, onClose, onSave }: ProfileSheetProps) {
  const [pseudo, setPseudo] = useState(user?.pseudo || "");
  const [description, setDescription] = useState(user?.description || "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslations();

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!pseudo.trim()) {
      setError("Name is required");
      return;
    }
    if (pseudo.length > 30) {
      setError("Name must be 30 characters or less");
      return;
    }
    if (description.length > 80) {
      setError("Description must be 80 characters or less");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSave({
        pseudo: pseudo.trim(),
        description: description.trim(),
        avatarColor,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#fff",
          borderRadius: "20px",
          width: "90%",
          maxWidth: "420px",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 9999,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header with gradient */}
        <div
          style={{
            background: `linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%)`,
            padding: spacing.xl,
            borderRadius: "20px 20px 0 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.md,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative blur circle */}
          <div
            style={{
              position: "absolute",
              width: 300,
              height: 300,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              top: -100,
              right: -100,
              pointerEvents: "none",
            }}
          />
          
          {/* Avatar Preview */}
          <div
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              position: "relative",
              cursor: "pointer",
              transform: "scale(1)",
              transition: "transform 0.2s ease",
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: avatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "4px solid rgba(255, 255, 255, 0.9)",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
              }}
            >
              <p style={{ fontSize: 32, fontWeight: 700, color: "#fff", margin: 0 }}>
                {getInitials(pseudo || "?")}
              </p>
            </div>
            <div
              style={{
                position: "absolute",
                inset: "-8px",
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                pointerEvents: "none",
              }}
            />
          </div>

          <div style={{ textAlign: "center", zIndex: 1 }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px 0" }}>
              {t("profile.editProfile")}
            </h2>
            <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)", margin: 0 }}>
              {showColorPicker ? t("profile.tapColor") : t("profile.tapAvatar")}
            </p>
          </div>
        </div>

        {/* Color Picker Grid - Below Header */}
        {showColorPicker && (
          <div style={{ padding: `${spacing.lg} ${spacing.lg} 0`, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md }}>
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setAvatarColor(color);
                  setShowColorPicker(false);
                }}
                style={{
                  aspectRatio: "1",
                  borderRadius: "16px",
                  backgroundColor: color,
                  border: avatarColor === color ? `4px solid ${colors.primary}` : "2px solid rgba(0, 0, 0, 0.08)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: avatarColor === color ? "scale(1.08)" : "scale(1)",
                  boxShadow: avatarColor === color ? `0 8px 16px ${color}40` : "0 2px 4px rgba(0, 0, 0, 0.05)",
                }}
                onMouseEnter={(e) => {
                  if (avatarColor !== color) {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = avatarColor === color ? "scale(1.08)" : "scale(1)";
                }}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: `${spacing.lg} ${spacing.lg}` }}>
          {/* Name Input */}
          <div style={{ marginBottom: spacing.lg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {t("profile.name")}
              </label>
              <span style={{ fontSize: "11px", color: colors.text.secondary, fontWeight: 500 }}>
                {pseudo.length} / 30
              </span>
            </div>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value.slice(0, 30))}
              placeholder={t("profile.namePlaceholder")}
              maxLength={30}
              style={{
                width: "100%",
                padding: `${spacing.sm} ${spacing.md}`,
                border: `2px solid ${colors.border}`,
                borderRadius: "10px",
                fontSize: "15px",
                fontFamily: "inherit",
                color: colors.text.primary,
                boxSizing: "border-box",
                transition: "all 0.2s ease",
                backgroundColor: "#fafafa",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.primary;
                (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 4px ${colors.primary}15`;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                (e.currentTarget as HTMLElement).style.backgroundColor = "#fafafa";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            />
          </div>

          {/* Description Input */}
          <div style={{ marginBottom: spacing.xl }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {t("profile.role")}
              </label>
              <span style={{ fontSize: "11px", color: colors.text.secondary, fontWeight: 500 }}>
                {description.length} / 80
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 80))}
              placeholder={t("profile.rolePlaceholder")}
              maxLength={80}
              rows={3}
              style={{
                width: "100%",
                padding: `${spacing.sm} ${spacing.md}`,
                border: `2px solid ${colors.border}`,
                borderRadius: "10px",
                fontSize: "15px",
                fontFamily: "inherit",
                color: colors.text.primary,
                boxSizing: "border-box",
                resize: "none",
                transition: "all 0.2s ease",
                backgroundColor: "#fafafa",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.primary;
                (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 4px ${colors.primary}15`;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                (e.currentTarget as HTMLElement).style.backgroundColor = "#fafafa";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            />
          </div>

          {/* Language Switcher */}
          <div style={{ marginBottom: spacing.xl, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Language
            </label>
            <LanguageSwitcher />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{ marginBottom: spacing.lg, padding: spacing.md, backgroundColor: "#fee2e2", borderRadius: "10px", border: `2px solid #fca5a5`, animation: "shake 0.3s ease" }}>
              <p style={{ fontSize: "13px", color: "#dc2626", margin: 0, fontWeight: 500 }}>⚠️ {error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: spacing.xl }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: `10px 20px`,
                backgroundColor: "transparent",
                border: `2px solid ${colors.border}`,
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: colors.text.primary,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "all 0.2s ease",
                minWidth: "90px",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                  (e.currentTarget as HTMLElement).style.borderColor = colors.text.secondary;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
              }}
            >
              {t("profile.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !pseudo.trim()}
              style={{
                padding: `10px 24px`,
                backgroundColor: colors.primary,
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading || !pseudo.trim() ? 0.6 : 1,
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(30, 58, 95, 0.25)",
                minWidth: "120px",
              }}
              onMouseEnter={(e) => {
                if (!loading && pseudo.trim()) {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 20px rgba(30, 58, 95, 0.35)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(30, 58, 95, 0.25)";
              }}
            >
                            {loading ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translate(-50%, -40%);
          }
          to { 
            opacity: 1; 
            transform: translate(-50%, -50%);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
}
