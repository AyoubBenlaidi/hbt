# Home Budget Tracker (HBT)

Production-grade web application for managing shared household expenses.

## Features

- **Multi-user households**: Invite family members and friends
- **Expense tracking**: Record who paid and who owes
- **Automatic balance calculation**: Know exactly who needs to pay whom
- **Transfer support**: Record reimbursements between members
- **Mobile-first design**: Works great on phone, tablet, and desktop

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle
- **Auth**: Supabase Auth
- **Deployment**: Vercel

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)

### Installation

```bash
# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Configure your environment variables
# - DATABASE_URL: PostgreSQL connection string
# - NEXT_PUBLIC_SUPABASE_URL: Your Supabase URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY: Your Supabase anon key
# - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
```

### Database Setup

```bash
# Generate initial migration from schema
npm run db:generate

# Apply migrations
npm run db:migrate

# Optional: Open Drizzle Studio to inspect the database
npm run db:studio
```

### Development

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
src/
├── app/              # Next.js pages and layouts
│   ├── (auth)/       # Authentication routes
│   ├── (dashboard)/  # Protected routes
│   └── page.tsx      # Home page
├── components/       # Reusable UI components
│   ├── forms/        # Form components
│   ├── layout/       # Layout components
│   └── ui/           # Basic UI components
├── modules/          # Business logic (services)
│   ├── households/   # Household management
│   ├── expenses/     # Expense and balance logic
│   └── ...
├── actions/          # Server Actions (mutations)
│   ├── households/   # Household actions
│   └── expenses/     # Expense actions
├── db/               # Database layer
│   ├── schema/       # Drizzle ORM schema
│   ├── queries/      # Database queries
│   └── migrations/   # Generated migrations
├── lib/              # Utilities and helpers
│   ├── db.ts         # Database client
│   ├── supabase/     # Supabase client
│   └── utils/        # Helper functions
└── types/            # TypeScript types
```

## Data Model

The application strictly follows the HBT Data Model (HBT-MDD.md):

**Core Tables**:
- `users`: Application users
- `households`: Shared expense groups
- `household_members`: User-household relationships
- `expenses`: Financial events
- `expense_payers`: Who paid
- `expense_splits`: Who owes

**Key Principle**:
```
balance = total_paid - total_owed
```

For every expense: `SUM(payers) = SUM(splits)`

## API Examples

### Create Household

```typescript
const householdId = await createHousehold("My House", userId);
```

### Add Expense

```typescript
const expenseId = await createExpense(
  householdId,
  userId,
  "Groceries",
  "50.00",
  "2024-01-15",
  [payerMemberId],
  [member1Id, member2Id], // participants
);
```

### Create Transfer (Reimbursement)

```typescript
const transferId = await createTransfer(
  householdId,
  userId,
  fromMemberId,
  toMemberId,
  "20.00",
  "2024-01-16",
  "Reimbursement for coffee"
);
```

### Calculate Balances

```typescript
const balance = await calculateHouseholdBalance(householdId);
// Returns: { memberBalances: [...], totalExpenses: "..." }
```

## Development Guidelines

- **Strict typing**: No `any` types
- **Separation of concerns**: UI → Actions → Services → Database
- **Financial accuracy**: All amounts use NUMERIC(12,2)
- **Soft deletes**: Expenses use `deleted_at` field
- **Security**: Access control at service layer

## Testing

```bash
npm run dev
# Navigate to http://localhost:3000/auth/login to test auth flow
```

## Production Build

```bash
npm run build
npm run start
```

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

Environment variables must be configured in Vercel dashboard.

## License

MIT
