"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Home,
  Users,
  Receipt,
  BarChart3,
  ArrowRight,
  Check,
  Smartphone,
  Shield,
  Clock,
  Heart,
  Zap,
  Eye,
  Menu,
  X,
  Plus,
  TrendingUp,
  CreditCard,
  PieChart,
  CalendarDays,
  UserPlus,
  ListChecks,
} from "lucide-react";

// ─── Scroll Reveal Hook ────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${delay ? `reveal-delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}

// ─── Section Wrapper ───────────────────────────────────────────────
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-24 md:py-32 lg:py-36 px-5 sm:px-8 ${className}`}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<"dashboard" | "expenses" | "households">("dashboard");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Preview", href: "#preview" },
  ];

  return (
    <div className="bg-hbt-bg text-hbt-text-primary overflow-x-hidden">
      {/* ══════════════════════════ NAVBAR ══════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-hbt-bg/90 backdrop-blur-lg border-b border-hbt-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16 md:h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-hbt-primary flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Home size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-hbt-primary tracking-tight">HBT</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-hbt-text-secondary hover:text-hbt-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-hbt-text-secondary hover:text-hbt-primary transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-hbt-primary hover:bg-hbt-primary-hover px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Get started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-hbt-text-secondary hover:text-hbt-primary transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-hbt-surface border-t border-hbt-border shadow-lg animate-fade-in">
            <div className="px-5 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="text-base font-medium text-hbt-text-secondary hover:text-hbt-primary py-3 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-hbt-border mt-2 pt-4 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="text-center text-sm font-semibold text-hbt-text-secondary border border-hbt-border py-2.5 rounded-xl hover:bg-hbt-surface-alt transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMobileMenu}
                  className="text-center text-sm font-semibold text-white bg-hbt-primary py-2.5 rounded-xl hover:bg-hbt-primary-hover transition-colors"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className="pt-28 md:pt-36 lg:pt-44 pb-16 md:pb-24 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div className="max-w-xl">
            <div className="animate-fade-in opacity-0">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-hbt-accent bg-hbt-accent-soft px-3.5 py-1.5 rounded-full mb-6">
                <Home size={13} />
                Shared household finance
              </span>
            </div>
            <h1 className="animate-fade-in opacity-0 text-[clamp(2rem,5.5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-hbt-primary mb-5">
              Shared expenses,
              <br />
              <span className="text-hbt-accent">without the friction</span>
            </h1>
            <p className="animate-fade-in-delay opacity-0 text-base md:text-lg text-hbt-text-secondary leading-relaxed mb-8 max-w-md">
              The cleanest way for couples, roommates, and households to track shared spending. Clear balances, zero awkwardness.
            </p>
            <div className="animate-fade-in-delay-2 opacity-0 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-hbt-primary hover:bg-hbt-primary-hover px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Start for free
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-sm font-semibold text-hbt-text-secondary border border-hbt-border hover:border-hbt-text-muted px-6 py-3 rounded-xl transition-all hover:bg-hbt-surface"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Product mockup */}
          <div className="animate-fade-in-delay-2 opacity-0 relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Glow behind */}
              <div className="absolute -inset-8 bg-gradient-to-br from-hbt-accent/10 via-hbt-primary/5 to-transparent rounded-3xl blur-2xl" />

              {/* Main card */}
              <div className="relative bg-hbt-surface rounded-2xl shadow-xl border border-hbt-border p-5 animate-float-slow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-hbt-text-muted uppercase tracking-wide">Net Balance</p>
                    <p className="text-2xl font-bold text-hbt-primary mt-0.5">+€124.50</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-hbt-success-soft flex items-center justify-center">
                    <TrendingUp size={18} className="text-hbt-success" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-hbt-success-soft/60 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">You paid</p>
                    <p className="text-base font-bold text-hbt-success mt-0.5">€489.00</p>
                  </div>
                  <div className="bg-hbt-danger-soft/60 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">You owe</p>
                    <p className="text-base font-bold text-hbt-danger mt-0.5">€364.50</p>
                  </div>
                </div>
                {/* Recent transactions */}
                <div className="border-t border-hbt-border pt-3">
                  <p className="text-[10px] font-semibold text-hbt-text-muted uppercase tracking-wide mb-2">Recent</p>
                  {[
                    { name: "Groceries — Carrefour", amount: "-€23.40", color: "text-hbt-danger" },
                    { name: "Electricity bill", amount: "+€45.00", color: "text-hbt-success" },
                    { name: "Dinner out", amount: "-€18.75", color: "text-hbt-danger" },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <p className="text-sm text-hbt-text-primary font-medium truncate mr-4">{t.name}</p>
                      <p className={`text-sm font-semibold ${t.color} whitespace-nowrap`}>{t.amount}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating card — household */}
              <div className="absolute -right-4 -bottom-4 md:-right-8 md:-bottom-6 bg-hbt-surface rounded-xl shadow-lg border border-hbt-border p-3 animate-float w-44">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-hbt-accent flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-hbt-primary flex items-center justify-center -ml-2">
                    <span className="text-[10px] font-bold text-white">S</span>
                  </div>
                  <p className="text-xs font-semibold text-hbt-text-primary ml-1">Home</p>
                </div>
                <p className="text-[10px] text-hbt-text-muted">3 members · 12 expenses</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ TRUST STRIP ══════════════════════════ */}
      <Section className="!py-12 md:!py-16 bg-hbt-surface border-y border-hbt-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center">
          {[
            { icon: Clock, text: "Track expenses in seconds" },
            { icon: Eye, text: "Clear balances at a glance" },
            { icon: Heart, text: "Made for real everyday life" },
          ].map((item, i) => (
            <Reveal key={i} delay={i + 1}>
              <div className="flex flex-col items-center gap-2.5">
                <item.icon size={20} className="text-hbt-accent" />
                <p className="text-sm font-semibold text-hbt-text-secondary">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════ PROBLEM → SOLUTION ══════════════════════════ */}
      <Section id="problem">
        <Reveal>
          <div className="text-center mb-14 md:mb-20">
            <p className="text-xs font-semibold text-hbt-accent uppercase tracking-wider mb-3">Why HBT</p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-hbt-primary tracking-tight mb-4">
              Shared expenses shouldn&apos;t be stressful
            </h2>
            <p className="text-base text-hbt-text-secondary max-w-lg mx-auto">
              From messy group chats to forgotten IOUs — we&apos;ve all been there. HBT makes it simple.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {[
            {
              before: "Who paid what already?",
              after: "Instantly clear",
              description: "Every expense is tracked with who paid and who owes. No more guessing.",
              icon: Receipt,
            },
            {
              before: "Scattered notes & messages",
              after: "One shared space",
              description: "Everything lives in one household. Invite members, track together.",
              icon: Users,
            },
            {
              before: "Awkward money conversations",
              after: "Balances speak for themselves",
              description: "Fair splits computed automatically. Clear numbers, zero confrontation.",
              icon: BarChart3,
            },
          ].map((card, i) => (
            <Reveal key={i} delay={i + 1}>
              <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-6 md:p-7 h-full flex flex-col group hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-hbt-accent-soft flex items-center justify-center mb-5">
                  <card.icon size={20} className="text-hbt-accent" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold text-hbt-danger bg-hbt-danger-soft px-2.5 py-1 rounded-lg line-through">
                    {card.before}
                  </span>
                </div>
                <p className="text-lg font-bold text-hbt-primary mb-2">{card.after}</p>
                <p className="text-sm text-hbt-text-secondary leading-relaxed">{card.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════ FEATURE SHOWCASE ══════════════════════════ */}
      <Section id="features" className="bg-hbt-surface-alt">
        <Reveal>
          <div className="text-center mb-14 md:mb-20">
            <p className="text-xs font-semibold text-hbt-accent uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-hbt-primary tracking-tight mb-4">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="text-base text-hbt-text-secondary max-w-lg mx-auto">
              Designed for real households, not accounting departments.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-16 md:gap-20">
          {[
            {
              title: "Shared households",
              text: "Create a household, invite your partner, roommates, or family. Everyone sees the same expenses, same balances, same clarity.",
              icon: Home,
              visual: (
                <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-hbt-primary flex items-center justify-center">
                      <span className="text-sm font-bold text-white">🏠</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-hbt-text-primary">Apartment 4B</p>
                      <p className="text-xs text-hbt-text-muted">3 members</p>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {["#1E3A5F", "#B85F3F", "#6B8E5E"].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-hbt-surface flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: c }}>
                        {["A", "S", "M"][i]}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              title: "Add expenses in seconds",
              text: "Quick entry with amount, description, and automatic fair split. No calculator, no spreadsheet, no back-and-forth.",
              icon: Zap,
              visual: (
                <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-hbt-text-primary">New Expense</p>
                    <div className="w-7 h-7 rounded-lg bg-hbt-primary flex items-center justify-center">
                      <Plus size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="bg-hbt-bg rounded-lg px-3 py-2">
                      <p className="text-[10px] text-hbt-text-muted mb-0.5">Description</p>
                      <p className="text-sm text-hbt-text-primary font-medium">Weekly groceries</p>
                    </div>
                    <div className="bg-hbt-bg rounded-lg px-3 py-2">
                      <p className="text-[10px] text-hbt-text-muted mb-0.5">Amount</p>
                      <p className="text-sm text-hbt-text-primary font-medium">€67.30</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-hbt-success" />
                      <p className="text-xs text-hbt-text-muted">Split equally among 3 members</p>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              title: "Clear balance overview",
              text: "See who paid, who owes, and the net balance at a glance. Switch between this month and all-time without losing context.",
              icon: PieChart,
              visual: (
                <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-5 shadow-sm">
                  <p className="text-xs font-semibold text-hbt-text-muted uppercase tracking-wide mb-3">Balance</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-hbt-success-soft/60 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">Paid</p>
                      <p className="text-lg font-bold text-hbt-success">€489</p>
                    </div>
                    <div className="bg-hbt-danger-soft/60 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">Owe</p>
                      <p className="text-lg font-bold text-hbt-danger">€365</p>
                    </div>
                  </div>
                  <div className="bg-hbt-bg rounded-xl p-3 text-center">
                    <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">Net</p>
                    <p className="text-xl font-bold text-hbt-primary">+€124.00</p>
                  </div>
                </div>
              ),
            },
            {
              title: "Smart period views",
              text: "Filter by this month, all time, or any custom date range. See spending trends and activity timeline exactly when you need them.",
              icon: CalendarDays,
              visual: (
                <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-5 shadow-sm">
                  <div className="flex gap-1.5 mb-4 bg-hbt-bg rounded-xl p-1">
                    {["This month", "All time", "Range"].map((label, i) => (
                      <div
                        key={label}
                        className={`flex-1 text-center text-[11px] font-semibold py-2 rounded-lg ${
                          i === 0 ? "bg-hbt-primary text-white shadow-sm" : "text-hbt-text-muted"
                        }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                      <div key={i} className="flex-1 flex gap-0.5">
                        <div className="flex-1 bg-hbt-success/30 rounded-t" style={{ height: `${h}%` }} />
                        <div className="flex-1 bg-hbt-danger/30 rounded-t" style={{ height: `${h * 0.7}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
          ].map((feature, i) => (
            <Reveal key={i}>
              <div className={`grid md:grid-cols-2 gap-8 md:gap-14 items-center ${i % 2 === 1 ? "md:[direction:rtl]" : ""}`}>
                <div className={i % 2 === 1 ? "md:[direction:ltr]" : ""}>
                  <div className="w-10 h-10 rounded-xl bg-hbt-accent-soft flex items-center justify-center mb-4">
                    <feature.icon size={20} className="text-hbt-accent" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-hbt-primary mb-3">{feature.title}</h3>
                  <p className="text-base text-hbt-text-secondary leading-relaxed">{feature.text}</p>
                </div>
                <div className={`flex ${i % 2 === 1 ? "md:[direction:ltr] justify-start" : "justify-end"}`}>
                  <div className="w-full max-w-xs">{feature.visual}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════ HOW IT WORKS ══════════════════════════ */}
      <Section id="how-it-works">
        <Reveal>
          <div className="text-center mb-14 md:mb-20">
            <p className="text-xs font-semibold text-hbt-accent uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-hbt-primary tracking-tight mb-4">
              Up and running in minutes
            </h2>
            <p className="text-base text-hbt-text-secondary max-w-lg mx-auto">
              No complex setup. No learning curve. Just start tracking.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-14 left-[12%] right-[12%] h-px bg-hbt-border" />

          {[
            { step: "01", title: "Create your household", description: "Give it a name. That's it.", icon: Home },
            { step: "02", title: "Invite members", description: "Share the household code with your group.", icon: UserPlus },
            { step: "03", title: "Track expenses", description: "Add what you spend. Splits are automatic.", icon: CreditCard },
            { step: "04", title: "See balances", description: "Everyone knows where they stand. Instantly.", icon: ListChecks },
          ].map((s, i) => (
            <Reveal key={i} delay={i + 1}>
              <div className="relative bg-hbt-surface rounded-2xl border border-hbt-border p-6 text-center h-full hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-full bg-hbt-primary text-white flex items-center justify-center mx-auto mb-4 text-sm font-bold relative z-10">
                  {s.step}
                </div>
                <s.icon size={22} className="text-hbt-accent mx-auto mb-3" />
                <h4 className="text-base font-bold text-hbt-primary mb-1.5">{s.title}</h4>
                <p className="text-sm text-hbt-text-secondary">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════ PRODUCT PREVIEW ══════════════════════════ */}
      <Section id="preview" className="bg-hbt-surface-alt">
        <Reveal>
          <div className="text-center mb-14 md:mb-16">
            <p className="text-xs font-semibold text-hbt-accent uppercase tracking-wider mb-3">Product preview</p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-hbt-primary tracking-tight mb-4">
              Clean, calm, and actually pleasant
            </h2>
            <p className="text-base text-hbt-text-secondary max-w-lg mx-auto">
              An app you&apos;ll want to open — not one you endure.
            </p>
          </div>
        </Reveal>

        <Reveal>
          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-hbt-bg border border-hbt-border rounded-xl p-1 gap-1">
              {([
                { key: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
                { key: "expenses" as const, label: "Expenses", icon: Receipt },
                { key: "households" as const, label: "Households", icon: Users },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActivePreviewTab(tab.key)}
                  className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all ${
                    activePreviewTab === tab.key
                      ? "bg-hbt-primary text-white shadow-sm"
                      : "text-hbt-text-muted hover:text-hbt-text-secondary"
                  }`}
                >
                  <tab.icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview panel */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-hbt-surface rounded-2xl border border-hbt-border shadow-lg overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-hbt-border bg-hbt-surface-alt">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-hbt-danger/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-hbt-accent/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-hbt-success/50" />
                </div>
                <p className="text-xs text-hbt-text-muted font-medium ml-2">
                  {activePreviewTab === "dashboard" && "Dashboard — Apartment"}
                  {activePreviewTab === "expenses" && "Expenses — April 2026"}
                  {activePreviewTab === "households" && "Households"}
                </p>
              </div>

              {/* Content */}
              <div className="p-5 md:p-6 min-h-[320px] transition-all">
                {activePreviewTab === "dashboard" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-hbt-bg rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">Net Balance</p>
                        <p className="text-lg font-bold text-hbt-primary mt-1">+€124.50</p>
                      </div>
                      <div className="bg-hbt-bg rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">You Owe</p>
                        <p className="text-lg font-bold text-hbt-danger mt-1">€364.50</p>
                      </div>
                      <div className="bg-hbt-bg rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-hbt-text-muted uppercase">You Paid</p>
                        <p className="text-lg font-bold text-hbt-success mt-1">€489.00</p>
                      </div>
                    </div>
                    <div className="border-t border-hbt-border pt-4">
                      <p className="text-[10px] font-semibold text-hbt-text-muted uppercase tracking-wide mb-3">Activity Timeline</p>
                      {[
                        { date: "April 14", name: "Groceries", amount: "-€23.40", type: "danger" },
                        { date: "April 14", name: "Electricity", amount: "+€45.00", type: "success" },
                        { date: "April 12", name: "Dinner out", amount: "-€18.75", type: "danger" },
                        { date: "April 10", name: "Rent split", amount: "+€400.00", type: "success" },
                      ].map((t, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-hbt-border/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-hbt-text-muted w-14">{t.date}</span>
                            <span className="text-sm font-medium text-hbt-text-primary">{t.name}</span>
                          </div>
                          <span className={`text-sm font-semibold ${t.type === "success" ? "text-hbt-success" : "text-hbt-danger"}`}>
                            {t.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePreviewTab === "expenses" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-hbt-text-primary">This month&apos;s expenses</p>
                      <div className="text-xs font-semibold text-white bg-hbt-primary px-3 py-1.5 rounded-lg">+ Add</div>
                    </div>
                    {[
                      { name: "Weekly groceries", amount: "€67.30", payer: "Ayoub", date: "Apr 15" },
                      { name: "Internet bill", amount: "€39.99", payer: "Sarah", date: "Apr 12" },
                      { name: "Gas & Electric", amount: "€85.00", payer: "Ayoub", date: "Apr 10" },
                      { name: "Dinner — Le Petit", amount: "€42.50", payer: "Marc", date: "Apr 8" },
                      { name: "Cleaning supplies", amount: "€15.80", payer: "Sarah", date: "Apr 5" },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-hbt-border/50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-hbt-text-primary">{e.name}</p>
                          <p className="text-xs text-hbt-text-muted">{e.payer} · {e.date}</p>
                        </div>
                        <p className="text-sm font-bold text-hbt-text-primary">{e.amount}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activePreviewTab === "households" && (
                  <div className="space-y-4">
                    {[
                      { name: "Apartment 4B", emoji: "🏠", members: 3, expenses: 24, balance: "+€124" },
                      { name: "Weekend cabin", emoji: "🏕️", members: 5, expenses: 8, balance: "-€32" },
                    ].map((h, i) => (
                      <div key={i} className="bg-hbt-bg rounded-xl p-4 border border-hbt-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{h.emoji}</span>
                            <div>
                              <p className="text-sm font-bold text-hbt-text-primary">{h.name}</p>
                              <p className="text-xs text-hbt-text-muted">{h.members} members · {h.expenses} expenses</p>
                            </div>
                          </div>
                          <p className={`text-sm font-bold ${h.balance.startsWith("+") ? "text-hbt-success" : "text-hbt-danger"}`}>
                            {h.balance}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ══════════════════════════ BENEFITS GRID ══════════════════════════ */}
      <Section>
        <Reveal>
          <div className="text-center mb-14 md:mb-20">
            <p className="text-xs font-semibold text-hbt-accent uppercase tracking-wider mb-3">Benefits</p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-hbt-primary tracking-tight mb-4">
              Built for how you actually live
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {[
            { icon: Heart, title: "No more awkward conversations", description: "Numbers do the talking. Fair splits, clear balances, zero tension." },
            { icon: Smartphone, title: "Beautiful on every device", description: "Mobile-first design that works on any screen, anywhere." },
            { icon: Zap, title: "Fast enough for daily use", description: "Add an expense in under 10 seconds. Built for real pace." },
            { icon: Shield, title: "Private and secure", description: "Your data stays yours. No ads, no selling, no compromise." },
            { icon: Eye, title: "Everything stays clear", description: "From this month to all-time, visibility without complexity." },
            { icon: Users, title: "Built for shared life", description: "Couples, roommates, families — every configuration works." },
          ].map((b, i) => (
            <Reveal key={i} delay={(i % 3) + 1}>
              <div className="bg-hbt-surface rounded-2xl border border-hbt-border p-6 h-full hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-hbt-accent-soft flex items-center justify-center mb-4">
                  <b.icon size={20} className="text-hbt-accent" />
                </div>
                <h4 className="text-base font-bold text-hbt-primary mb-1.5">{b.title}</h4>
                <p className="text-sm text-hbt-text-secondary leading-relaxed">{b.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════ FINAL CTA ══════════════════════════ */}
      <Section className="!py-20 md:!py-28">
        <Reveal>
          <div className="bg-gradient-to-br from-hbt-primary to-[#17304F] rounded-3xl px-8 py-16 md:px-16 md:py-20 text-center relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4">
                Make shared expenses feel
                <br />
                <span className="text-hbt-accent">simple again</span>
              </h2>
              <p className="text-base text-white/70 max-w-md mx-auto mb-8">
                Start with one household, one expense, one clear balance. Everything else follows naturally.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-sm font-semibold bg-white text-hbt-primary hover:bg-hbt-bg px-7 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Start for free
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 border border-white/20 hover:border-white/40 px-7 py-3.5 rounded-xl transition-all"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ══════════════════════════ FOOTER ══════════════════════════ */}
      <footer className="border-t border-hbt-border bg-hbt-surface py-12 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-hbt-primary flex items-center justify-center">
                <Home size={14} className="text-white" />
              </div>
              <span className="text-base font-bold text-hbt-primary tracking-tight">HBT</span>
            </Link>
            <p className="text-xs text-hbt-text-muted">Shared household expense management</p>
          </div>

          <div className="flex items-center gap-6 text-sm text-hbt-text-secondary">
            <a href="#features" className="hover:text-hbt-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-hbt-primary transition-colors">How it works</a>
            <Link href="/login" className="hover:text-hbt-primary transition-colors">Log in</Link>
            <Link href="/signup" className="hover:text-hbt-primary transition-colors">Sign up</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-hbt-border/60 text-center">
          <p className="text-xs text-hbt-text-muted">&copy; {new Date().getFullYear()} HBT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
