# HBT Development Quick Reference

## Quick Start

```bash
# From project root
cd c:\Users\abenlaidi\HBT\home-budget-tracker

# 1. Install
npm install

# 2. Setup database
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply them

# 3. Run dev server
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## Folder Quick Access

| Folder | Contains | Purpose |
|--------|----------|---------|
| `src/app` | Pages & layouts | Next.js App Router |
| `src/modules` | Services | Business logic |
| `src/actions` | Server actions | Mutations (POST/PUT/DELETE) |
| `src/components` | Reusable UI | React components |
| `src/db/schema` | Tables | Drizzle ORM definitions |
| `src/lib` | Utilities | Helpers, validation, clients |
| `src/types` | Types | TypeScript definitions |

---

## Core Services

### Households (`src/modules/households/index.ts`)

```typescript
createHousehold(name, userId)              // Create & add creator
getHouseholdWithMembers(householdId)       // Fetch with members
getUserHouseholds(userId)                  // List user's households
addHouseholdMember(householdId, userId)    // Add member
isHouseholdMember(householdId, userId)     // Check membership
```

### Expenses (`src/modules/expenses/index.ts`)

```typescript
createExpense(...)                         // Create expense
createTransfer(...)                        // Create transfer (reimbursement)
getExpenseWithDetails(expenseId)           // Fetch expense details
getHouseholdExpenses(householdId)          // List expenses
calculateMemberBalance(...)                // Get balance for one member
calculateHouseholdBalance(householdId)     // Get all members' balances
```

### Users (`src/modules/users/index.ts`)

```typescript
createUser(email, displayName)             // Create user
getUserById(userId)                        // Fetch by ID
getUserByEmail(email)                      // Fetch by email
updateUserDisplayName(userId, name)        // Update name
```

### Auth (`src/modules/auth/index.ts`)

```typescript
signUp(email, password, displayName)       // Sign up
signIn(email, password)                    // Sign in
signOut()                                  // Sign out
getCurrentUser()                           // Get logged-in user
```

---

## Server Actions

### Households (`src/actions/households/create.ts`)

```typescript
createHouseholdAction(name, userId)        // Server action for creating
addHouseholdMemberAction(householdId, userId)
```

### Expenses (`src/actions/expenses/create.ts`)

```typescript
createExpenseAction(...)                   // Create expense
createTransferAction(...)                  // Create transfer
```

### Auth (`src/actions/auth/index.ts`)

```typescript
signUpAction(email, password, displayName)
signInAction(email, password)
signOutAction()
```

---

## Database Tables

### users
```sql
id (UUID, PK)
email (VARCHAR, UNIQUE)
display_name (VARCHAR)
password_hash (VARCHAR, nullable)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### households
```sql
id (UUID, PK)
name (VARCHAR)
created_by_user_id (UUID, FK→users)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### household_members
```sql
id (UUID, PK)
household_id (UUID, FK→households)
user_id (UUID, FK→users)
role (VARCHAR, default='member')
status (VARCHAR, default='active')
joined_at (TIMESTAMP)
left_at (TIMESTAMP, nullable)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
UNIQUE: (household_id, user_id)
```

### expenses
```sql
id (UUID, PK)
household_id (UUID, FK→households)
created_by_user_id (UUID, FK→users)
description (VARCHAR)
expense_date (DATE)
currency (CHAR(3), default='EUR')
expense_kind (VARCHAR, CHECK: 'expense'|'transfer')
notes (TEXT, nullable)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP, nullable)
```

### expense_payers
```sql
id (UUID, PK)
expense_id (UUID, FK→expenses)
member_id (UUID, FK→household_members)
amount (NUMERIC(12,2), > 0)
created_at (TIMESTAMP)
```

### expense_splits
```sql
id (UUID, PK)
expense_id (UUID, FK→expenses)
member_id (UUID, FK→household_members)
amount (NUMERIC(12,2), ≥ 0)
created_at (TIMESTAMP)
UNIQUE: (expense_id, member_id)
```

---

## Key Formulas

**Balance per member**:
```
balance = SUM(payers.amount) - SUM(splits.amount)
```

**Accounting rule**:
```
SUM(payers.amount) == SUM(splits.amount)
```

---

## Common Tasks

### Adding a new feature

1. Design schema changes in `src/db/schema/index.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply
4. Create service function in `src/modules/*/index.ts`
5. Create server action in `src/actions/*/`
6. Create/update UI in `src/app/`

### Fixing a bug

1. Identify the module (UI, service, DB)
2. Write test case
3. Fix in that module
4. Test end-to-end

### Adding validation

1. Add Zod schema in `src/lib/validation.ts`
2. Use in server action with `.parse()` or `.safeParse()`
3. Return error response if validation fails

---

## Important Patterns

### Service Layer Pattern
```typescript
// src/modules/resource/index.ts (business logic)
export async function doSomething(...) {
  const db = getDb();
  // database operations...
  return result;
}

// src/actions/resource/action.ts (server action)
"use server";
export async function doSomethingAction(...) {
  try {
    const result = await doSomething(...);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Type-Safe Responses
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Strict TypeScript
- Always use strict mode
- No `any` types
- Use `as const` for literals
- Export types alongside implementations

---

## Debugging

### Drizzle Studio
```bash
npm run db:studio
# Opens localhost:5173 with DB explorer
```

### Server Actions
- Check browser console for errors
- Check terminal for server-side errors
- Use `.safeParse()` for detailed error info

### Authentication
- Check Supabase dashboard for user records
- Verify environment variables
- Test with hardcoded credentials first

### Database
- Use Drizzle Studio to inspect tables
- Check for constraint violations
- Verify migrations applied: `np` run db:migrate`

---

## Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Supabase Auth configured
- [ ] Error handling production-ready
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Logging enabled
- [ ] Backups configured
- [ ] Monitoring setup
- [ ] Load testing done

---

## Resources

- **Drizzle Docs**: https://orm.drizzle.team
- **Next.js 15**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs
- **Zod**: https://zod.dev

---

**Last Updated**: April 12, 2026
