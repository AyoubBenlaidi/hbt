import { z } from "zod";

/**
 * Validation Schemas using Zod
 */

// Auth
export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Name must be at least 2 characters"),
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Household
export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required").max(255),
});

// Expense
export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(255),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    "Amount must be a positive number"
  ),
  expenseDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "Invalid date"
  ),
  payerMemberIds: z.array(z.string().uuid()).min(1, "At least one payer is required"),
  splitMemberIds: z.array(z.string().uuid()).min(1, "At least one participant is required"),
  notes: z.string().max(500).optional(),
});

// Transfer
export const transferSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    "Amount must be a positive number"
  ),
  fromMemberId: z.string().uuid("Invalid member ID"),
  toMemberId: z.string().uuid("Invalid member ID"),
  transferDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "Invalid date"
  ),
  description: z.string().optional(),
});

// Type exports
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
