import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  varchar, 
  date, 
  numeric, 
  unique,
  check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Users Table
 * Represents an application user
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
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
});

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

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpensePayer = typeof expensePayers.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type InsertHousehold = typeof households.$inferInsert;
export type InsertHouseholdMember = typeof householdMembers.$inferInsert;
export type InsertExpense = typeof expenses.$inferInsert;
export type InsertExpensePayer = typeof expensePayers.$inferInsert;
export type InsertExpenseSplit = typeof expenseSplits.$inferInsert;
