import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  varchar, 
  date, 
  numeric, 
  unique,
  check,
  boolean,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Users Table
 * Represents an application user
 */
export const users = pgTable("users", {
  // Same id as the auth account: no default
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Households Table
 * Logical grouping of users
 */
export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  joinCode: varchar("join_code", { length: 8 }).notNull(),
  joinCodeEnabled: boolean("join_code_enabled").notNull().default(true),
  joinCodeUpdatedAt: timestamp("join_code_updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  joinCodeIdx: uniqueIndex("idx_households_join_code").on(t.joinCode),
}));

/**
 * Household Members Table
 * Links users to households
 */
export const householdMembers = pgTable("household_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueMembership: unique("unique_household_member").on(t.householdId, t.userId),
}));

/**
 * Expenses Table
 * Represents a financial event
 */
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  description: varchar("description", { length: 255 }).notNull(),
  expenseDate: date("expense_date").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  expenseKind: varchar("expense_kind", { length: 50 }).notNull(),
  notes: text("notes"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  kindCheck: check("expense_kind_check", 
    sql`${t.expenseKind} IN ('expense', 'transfer')`
  ),
}));

/**
 * Expense Payers Table
 * Defines who paid
 */
export const expensePayers = pgTable("expense_payers", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  amountCheck: check("payer_amount_check", 
    sql`${t.amount}::numeric > 0`
  ),
}));

/**
 * Expense Splits Table
 * Defines who owes what
 */
export const expenseSplits = pgTable("expense_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueMemberExpense: unique("unique_expense_split").on(t.expenseId, t.memberId),
  amountCheck: check("split_amount_check", 
    sql`${t.amount}::numeric >= 0`
  ),
}));

/**
 * User Profiles Table
 * Public profile (pseudo, avatar) of a user
 */
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  pseudo: varchar("pseudo", { length: 30 }).notNull(),
  description: varchar("description", { length: 80 }),
  avatarColor: varchar("avatar_color", { length: 7 }).notNull().default("#4A7C59"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pseudoIdx: uniqueIndex("idx_user_profiles_pseudo").on(t.pseudo),
}));

/**
 * Household Join Requests Table
 * Requests to join a household with its join code
 */
export const householdJoinRequests = pgTable("household_join_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  requesterUserId: uuid("requester_user_id").notNull(),
  codeUsed: varchar("code_used", { length: 8 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByUserId: uuid("reviewed_by_user_id"),
}, (t) => ({
  statusCheck: check("household_join_requests_status_check",
    sql`${t.status} IN ('pending', 'approved', 'rejected', 'cancelled')`
  ),
  onePendingIdx: uniqueIndex("idx_one_pending_per_user_household")
    .on(t.householdId, t.requesterUserId)
    .where(sql`status = 'pending'`),
  householdIdx: index("idx_join_requests_household").on(t.householdId),
  requesterIdx: index("idx_join_requests_requester").on(t.requesterUserId),
}));

/**
 * Monthly Reports Table
 * Sent monthly report emails (prevents duplicates on cron retries)
 */
export const monthlyReports = pgTable("monthly_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueHouseholdMonth: unique("monthly_reports_household_id_month_key").on(t.householdId, t.month),
}));

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpensePayer = typeof expensePayers.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type HouseholdJoinRequest = typeof householdJoinRequests.$inferSelect;
export type MonthlyReport = typeof monthlyReports.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertHousehold = typeof households.$inferInsert;
export type InsertHouseholdMember = typeof householdMembers.$inferInsert;
export type InsertExpense = typeof expenses.$inferInsert;
export type InsertExpensePayer = typeof expensePayers.$inferInsert;
export type InsertExpenseSplit = typeof expenseSplits.$inferInsert;
