import type { 
  User,
  Household,
  HouseholdMember,
  Expense,
  ExpensePayer,
  ExpenseSplit,
} from "@/db/schema";

/**
 * Application Types
 */

export type IUser = User;
export type IHousehold = Household;
export type IHouseholdMember = HouseholdMember;
export type IExpense = Expense;
export type IExpensePayer = ExpensePayer;
export type IExpenseSplit = ExpenseSplit;

/**
 * API Response Types
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Household with members
 */
export interface HouseholdWithMembers extends IHousehold {
  members: HouseholdMember[];
}

/**
 * Expense with details
 */
export interface ExpenseWithDetails extends IExpense {
  payers: (ExpensePayer & { member: HouseholdMember })[];
  splits: (ExpenseSplit & { member: HouseholdMember })[];
}

/**
 * Member Balance
 */
export interface MemberBalance {
  memberId: string;
  member: HouseholdMember;
  totalPaid: string;
  totalOwed: string;
  balance: string;
}

/**
 * Household Balance Summary
 */
export interface HouseholdBalance {
  householdId: string;
  memberBalances: MemberBalance[];
  totalExpenses: string;
}

/**
 * Form Types
 */

export interface CreateHouseholdInput {
  name: string;
}

export interface CreateExpenseInput {
  description: string;
  amount: string;
  payerMemberId: string;
  participantMemberIds: string[];
  expenseDate: string;
  notes?: string;
}

export interface TransferInput {
  amount: string;
  fromMemberId: string;
  toMemberId: string;
  description: string;
  transferDate: string;
}
