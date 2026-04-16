"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { createExpenseAction } from "@/actions/expenses/create";
import { PremiumCard, ActionButton } from "@/components/ui/PremiumComponents";
import { colors, spacing } from "@/lib/designSystem";
import { useTranslations } from "@/hooks/useI18n";

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  expense_kind: string;
  notes?: string;
  created_by_user_id: string;
  household_id: string;
}

interface HouseholdMember {
  id: string;
  user_id: string;
  household_id: string;
  role: string;
  status: string;
  users?: any;
}

type ExpenseStep = "amount" | "description" | "date" | "payers" | "splits" | "review";

interface ExpenseFormProps {
  householdId: string;
  expenseId?: string;
  initialExpense?: Expense;
  onSuccess?: () => void;
}

export function ExpenseForm({ householdId, expenseId, initialExpense, onSuccess }: ExpenseFormProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslations();
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ExpenseStep>("amount");
  const [formData, setFormData] = useState({
    description: initialExpense?.description || "",
    amount: initialExpense?.amount?.toString() || "",
    currency: initialExpense?.currency || "EUR",
    expense_date: initialExpense?.expense_date || new Date().toISOString().split("T")[0],
    notes: initialExpense?.notes || "",
    payers: (initialExpense as any)?.expense_payers?.map((p: any) => p.household_members?.id) || ([] as string[]),
    splits: (initialExpense as any)?.expense_splits?.map((s: any) => s.household_members?.id) || ([] as string[]),
  });

  const steps: ExpenseStep[] = ["amount", "description", "date", "payers", "splits", "review"];
  const stepIndex = steps.indexOf(currentStep);
  const isEditMode = !!expenseId;

  const stepLabels: Record<ExpenseStep, string> = {
    amount: t("expenses.stepAmount"),
    description: t("expenses.stepDescription"),
    date: t("expenses.stepDate"),
    payers: t("expenses.stepPayers"),
    splits: t("expenses.stepSplits"),
    review: t("expenses.stepReview"),
  };

  // Fetch household members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error: err } = await supabase
          .from("household_members")
          .select("id, user_id, household_id, role, status, users(display_name, email)")
          .eq("household_id", householdId)
          .eq("status", "active");

        if (err) throw err;
        setHouseholdMembers(data || []);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };

    fetchMembers();
  }, [householdId]);

  const getMemberName = (member: HouseholdMember) => {
    if (Array.isArray(member.users) && member.users[0]) {
      return member.users[0].display_name || member.users[0].email;
    }
    return member.users?.display_name || member.users?.email || member.user_id;
  };

  const handleNextStep = () => {
    if (currentStep === "amount" && !formData.amount) {
      addToast("Please enter an amount", "error", 2000);
      return;
    }
    if (currentStep === "description" && !formData.description.trim()) {
      addToast("Please enter a description", "error", 2000);
      return;
    }
    if (currentStep === "payers" && formData.payers.length === 0) {
      addToast("Please select at least one payer", "error", 2000);
      return;
    }
    if (currentStep === "splits" && formData.splits.length === 0) {
      addToast("Please select at least one member", "error", 2000);
      return;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handlePrevStep = () => {
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (isEditMode && expenseId) {
        // Update mode
        const { error: updateErr } = await supabase
          .from("expenses")
          .update({
            description: formData.description,
            amount: formData.amount,
            currency: formData.currency,
            expense_date: formData.expense_date,
            notes: formData.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", expenseId);

        if (updateErr) throw updateErr;

        // Delete old payers
        const { error: deletePayersErr } = await supabase
          .from("expense_payers")
          .delete()
          .eq("expense_id", expenseId);

        if (deletePayersErr) throw deletePayersErr;

        // Insert new payers
        if (formData.payers.length > 0) {
          const payersToInsert = formData.payers.map((payerId: string) => ({
            expense_id: expenseId,
            member_id: payerId,
            amount: parseFloat(formData.amount || "0") / formData.payers.length,
          }));

          const { error: insertPayersErr } = await supabase
            .from("expense_payers")
            .insert(payersToInsert);

          if (insertPayersErr) throw insertPayersErr;
        }

        // Delete old splits
        const { error: deleteSplitsErr } = await supabase
          .from("expense_splits")
          .delete()
          .eq("expense_id", expenseId);

        if (deleteSplitsErr) throw deleteSplitsErr;

        // Insert new splits
        if (formData.splits.length > 0) {
          const splitsToInsert = formData.splits.map((memberId: string) => ({
            expense_id: expenseId,
            member_id: memberId,
            amount: parseFloat(formData.amount || "0") / formData.splits.length,
          }));

          const { error: insertSplitsErr } = await supabase
            .from("expense_splits")
            .insert(splitsToInsert);

          if (insertSplitsErr) throw insertSplitsErr;
        }

        addToast("Expense updated successfully!", "success", 2000);
      } else {
        // Create mode
        const result = await createExpenseAction(
          householdId,
          user!.id,
          formData.description,
          formData.amount,
          formData.expense_date,
          formData.payers,
          formData.splits,
          formData.notes || undefined
        );

        if (!result.success) {
          addToast(result.error || "Failed to create expense", "error", 3000);
          setIsSubmitting(false);
          return;
        }

        addToast("Expense created successfully!", "success", 2000);
      }

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error submitting expense:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      addToast(`Failed to submit expense: ${errorMessage}`, "error", 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: spacing.lg,
        paddingBottom: "100px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: spacing.lg }}>
                    {isEditMode ? t("expenses.editExpenseTitle") : t("expenses.addExpenseTitle")}
        </h1>

        {/* Progress Indicator */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
            gap: spacing.xs,
            marginBottom: spacing.xl,
            alignItems: "center",
          }}
        >
          {steps.map((step, idx) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: idx <= stepIndex ? colors.primary : colors.border,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "600",
                  transition: "all 0.3s ease",
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background: idx < stepIndex ? colors.primary : colors.border,
                    transition: "background 0.3s ease",
                    minWidth: "8px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <PremiumCard>
          <div style={{ minHeight: "180px" }}>
            {currentStep === "amount" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
                  {stepLabels.amount}
                </h2>
                <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.md, flexWrap: "wrap" }}>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{
                      flex: 1,
                      minWidth: "120px",
                      padding: spacing.md,
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      fontSize: "16px",
                    }}
                    autoFocus
                  />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    style={{
                      padding: spacing.md,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "8px",
                      fontSize: "16px",
                      minWidth: "80px",
                    }}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <p style={{ fontSize: "12px", color: colors.text.secondary }}>
                  {t("expenses.amount")}: {formData.currency} {parseFloat(formData.amount || "0").toFixed(2)}
                </p>
              </div>
            )}

            {currentStep === "description" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
                  {stepLabels.description}
                </h2>
                <input
                  type="text"
                  placeholder={t("expenses.descPlaceholder")}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: spacing.md,
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "16px",
                    marginBottom: spacing.md,
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <textarea
                  placeholder={t("expenses.addNotes")}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: spacing.md,
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    minHeight: "80px",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {currentStep === "date" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
                  {stepLabels.date}
                </h2>
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  style={{
                    width: "100%",
                    padding: spacing.md,
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <p style={{ fontSize: "12px", color: colors.text.secondary, marginTop: spacing.sm }}>
                  {t("expenses.selected")}: {new Date(formData.expense_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {currentStep === "payers" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
                  {stepLabels.payers}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                  {householdMembers.map((member) => (
                    <label
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: spacing.md,
                        border: formData.payers.includes(member.id)
                          ? `2px solid ${colors.primary}`
                          : `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: formData.payers.includes(member.id) ? "#EFF6FF" : "white",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.payers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, payers: [...formData.payers, member.id] });
                          } else {
                            setFormData({
                              ...formData,
                              payers: formData.payers.filter((id: string) => id !== member.id),
                            });
                          }
                        }}
                        style={{ marginRight: spacing.sm, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "14px" }}>{getMemberName(member)}</span>
                    </label>
                  ))}
                </div>
                {formData.payers.length > 0 && (
                  <p style={{ fontSize: "12px", color: colors.success, marginTop: spacing.md }}>
                    ✓ {t("expenses.eachPayer")} 1/{formData.payers.length} {t("expenses.of")} €
                    {parseFloat(formData.amount || "0").toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {currentStep === "splits" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.md }}>
                  {stepLabels.splits}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
                  {householdMembers.map((member) => (
                    <label
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: spacing.md,
                        border: formData.splits.includes(member.id)
                          ? `2px solid ${colors.primary}`
                          : `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: formData.splits.includes(member.id) ? "#EFF6FF" : "white",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.splits.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, splits: [...formData.splits, member.id] });
                          } else {
                            setFormData({
                              ...formData,
                              splits: formData.splits.filter((id: string) => id !== member.id),
                            });
                          }
                        }}
                        style={{ marginRight: spacing.sm, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "14px" }}>{getMemberName(member)}</span>
                    </label>
                  ))}
                </div>
                {formData.splits.length > 0 && (
                  <p style={{ fontSize: "12px", color: colors.success, marginTop: spacing.md }}>
                    ✓ {t("expenses.eachBeneficiary")} 1/{formData.splits.length} {t("expenses.of")} €
                    {parseFloat(formData.amount || "0").toFixed(2)}
                  </p>
                )}
              </div>
            )}

            {currentStep === "review" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: spacing.lg }}>{t("expenses.review")}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, fontSize: "14px" }}>
                  <div style={{ paddingBottom: spacing.md, borderBottom: `1px solid #E5E7EB` }}>
                    <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("expenses.description")}</p>
                    <p style={{ fontWeight: "600", wordBreak: "break-word" }}>{formData.description}</p>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: spacing.md,
                    }}
                  >
                    <div style={{ paddingBottom: spacing.md, borderBottom: `1px solid #E5E7EB` }}>
                      <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("expenses.amount")}</p>
                      <p style={{ fontWeight: "600" }}>
                        {formData.currency} {parseFloat(formData.amount || "0").toFixed(2)}
                      </p>
                    </div>
                    <div style={{ paddingBottom: spacing.md, borderBottom: `1px solid #E5E7EB` }}>
                      <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("expenses.date")}</p>
                      <p style={{ fontWeight: "600" }}>
                        {new Date(formData.expense_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div style={{ paddingBottom: spacing.md, borderBottom: `1px solid #E5E7EB` }}>
                    <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("expenses.paidBy")}</p>
                    <p style={{ fontWeight: "600", fontSize: "13px", wordBreak: "break-word" }}>
                      {formData.payers
                        .map((id: string) => {
                          const member = householdMembers.find((m) => m.id === id);
                          return member ? getMemberName(member) : id;
                        })
                        .join(", ")}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>{t("expenses.splitBetween")}</p>
                    <p style={{ fontWeight: "600", fontSize: "13px", wordBreak: "break-word" }}>
                      {formData.splits
                        .map((id: string) => {
                          const member = householdMembers.find((m) => m.id === id);
                          return member ? getMemberName(member) : id;
                        })
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: "flex", gap: spacing.md, marginTop: spacing.lg, flexWrap: "wrap" }}>
            {stepIndex > 0 && (
              <ActionButton
                label={t("expenses.back")}
                onClick={handlePrevStep}
                variant="secondary"
                style={{ flex: 1, minWidth: "100px" }}
              />
            )}
            {stepIndex < steps.length - 1 && (
              <ActionButton
                label={t("expenses.next")}
                onClick={handleNextStep}
                style={{ flex: 1, minWidth: "100px" }}
              />
            )}
            {stepIndex === steps.length - 1 && (
              <ActionButton
                label={isSubmitting ? (isEditMode ? t("expenses.updating") : t("expenses.creating")) : isEditMode ? t("expenses.update") : t("expenses.confirm")}
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, minWidth: "100px" }}
              />
            )}
          </div>
        </PremiumCard>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
