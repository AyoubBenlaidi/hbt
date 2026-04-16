"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { colors, spacing, transitions } from "@/lib/designSystem";
import { DashboardIcon, HouseholdsIcon, ExpensesIcon, PlusIcon, LogoutIcon } from "@/components/icons/NavigationIcons";
import { Avatar, ProfileSheet } from "@/components/profile";
import { useTranslations } from "@/hooks/useI18n";

export const GlobalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useUserProfile(user?.id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const { t } = useTranslations();

  const isActive = (path: string) => pathname.startsWith(path);

  const navigationItems = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: DashboardIcon },
    { href: "/households", label: t("nav.households"), icon: HouseholdsIcon },
    { href: "/expenses", label: t("nav.expenses"), icon: ExpensesIcon },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: colors.background,
      }}
    >
      {/* Sticky Top Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: colors.card,
          boxShadow: `0 1px 3px ${colors.border}`,
          backdropFilter: "blur(10px)",
          width: "100%",
        }}
      >
        <nav
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: `${spacing.md} ${spacing.md}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            boxSizing: "border-box",
            gap: spacing.md,
            position: "relative",
          }}
        >
          {/* Mobile Menu Button - Leftmost - with Dropdown Container */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: spacing.sm,
                margin: `0 0 0 -${spacing.sm}`,
              }}
              className="md:hidden"
            >
              <div style={{ width: "24px", height: "2px", backgroundColor: colors.text.primary }}></div>
              <div style={{ width: "24px", height: "2px", backgroundColor: colors.text.primary }}></div>
              <div style={{ width: "24px", height: "2px", backgroundColor: colors.text.primary }}></div>
            </button>

            {/* Mobile Navigation Menu Dropdown */}
            {isMobileMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "250px",
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.md,
                  padding: spacing.md,
                  backgroundColor: colors.card,
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  boxShadow: `0 4px 12px rgba(0, 0, 0, 0.15)`,
                  zIndex: 50,
                  marginTop: spacing.sm,
                }}
              >
                {navigationItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      style={{
                        fontWeight: "500",
                        fontSize: "14px",
                        color: isActive(item.href) ? colors.primary : colors.text.secondary,
                        textDecoration: "none",
                        display: "flex",
                        gap: spacing.sm,
                        alignItems: "center",
                      }}
                    >
                      <IconComponent 
                        size={20} 
                        color={isActive(item.href) ? colors.primary : colors.text.secondary}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Logo - Center on mobile, left on desktop */}
          <Link
            href="/dashboard"
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: colors.primary,
              textDecoration: "none",
              letterSpacing: "-1px",
              flex: 1,
              textAlign: "left",
            }}
          >
            HBT
          </Link>

          {/* User Section - Rightmost */}
          <div style={{ display: "flex", gap: spacing.md, alignItems: "center" }}>
            {user && profile && (
              <button
                onClick={() => setIsProfileSheetOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "8px",
                  transition: transitions.fast,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = colors.background;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                <Avatar user={profile} size="sm" />
                <span style={{ fontSize: "13px", fontWeight: "500", color: colors.text.primary }}>
                  {profile.pseudo}
                </span>
              </button>
            )}
            <button
              onClick={handleSignOut}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: "transparent",
                color: colors.text.secondary,
                border: `1px solid ${colors.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                transition: transitions.fast,
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.text.primary;
                e.currentTarget.style.borderColor = colors.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.text.secondary;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <LogoutIcon size={18} color="currentColor" strokeWidth={2} />
              <span style={{ fontSize: "12px", fontWeight: "500" }}>{t("nav.logout")}</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          padding: spacing.md,
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.card,
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.xs,
          padding: spacing.sm,
          zIndex: 50,
        }}
      >
        {/* Navigation items */}
        <div style={{ display: "flex", gap: spacing.xs, flex: 1 }}>
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: spacing.sm,
                  fontSize: "11px",
                  fontWeight: "500",
                  color: isActive(item.href) ? colors.primary : colors.text.secondary,
                  textDecoration: "none",
                  borderRadius: "8px",
                  backgroundColor: isActive(item.href) ? colors.background : "transparent",
                  transition: transitions.fast,
                  flex: 1,
                }}
              >
                <IconComponent 
                  size={20} 
                  color={isActive(item.href) ? colors.primary : colors.text.secondary}
                  strokeWidth={2}
                />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Primary CTA - Add Expense Button */}
        <button
          onClick={() => router.push("/expenses")}
          style={{
            padding: `${spacing.md} ${spacing.lg}`,
            backgroundColor: colors.primary,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: transitions.fast,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <PlusIcon size={24} color="white" strokeWidth={3} />
        </button>
      </nav>

      {/* Mobile padding */}
      <div className="md:hidden" style={{ height: spacing.xl }} />

      {/* Profile Sheet Modal */}
      {profile && (
        <ProfileSheet
          isOpen={isProfileSheetOpen}
          user={profile}
          onClose={() => setIsProfileSheetOpen(false)}
          onSave={async (updates) => {
            await updateProfile(updates);
          }}
        />
      )}
    </div>
  );
};
