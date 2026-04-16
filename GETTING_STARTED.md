# 🚀 Getting Started Checklist

Follow these steps to get Home Budget Tracker (HBT) running locally:

---

## Phase 1: Environment Setup (10 mins)

- [ ] Open terminal
- [ ] Navigate to project:
  ```bash
  cd c:\Users\abenlaidi\HBT\home-budget-tracker
  ```
- [ ] Copy environment template:
  ```bash
  copy .env.example .env.local
  ```
- [ ] Open `.env.local` and fill in:
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` - From Supabase dashboard
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase dashboard
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` - From Supabase settings

---

## Phase 2: Install Dependencies (5 mins)

- [ ] Install packages:
  ```bash
  npm install
  ```

---

## Phase 3: Database Setup (10 mins)

- [ ] Generate initial migration:
  ```bash
  npm run db:generate
  ```
  Expected: Creates your first migration in `src/db/migrations/`

- [ ] Apply migration to database:
  ```bash
  npm run db:migrate
  ```
  Expected: All tables created in PostgreSQL

- [ ] Optional - Verify database:
  ```bash
  npm run db:studio
  ```
  Expected: Opens Drizzle Studio at localhost:5173

---

## Phase 4: Start Development Server (2 mins)

- [ ] Start the dev server:
  ```bash
  npm run dev
  ```
  Expected: Server runs on http://localhost:3000

---

## Phase 5: Test the Application (10 mins)

### Test Sign Up
- [ ] Open http://localhost:3000
- [ ] Click "Get Started"
- [ ] Go to http://localhost:3000/auth/signup
- [ ] Create test account:
  - Name: "Test User"
  - Email: "test@example.com"
  - Password: "TestPassword123"
  - Confirm: "TestPassword123"
- [ ] Expected: Redirects to login page

### Test Sign In
- [ ] At login page, enter credentials:
  - Email: "test@example.com"
  - Password: "TestPassword123"
- [ ] Click "Sign In"
- [ ] Expected: Redirects to /households

### Test Create Household
- [ ] You're now at households page
- [ ] Enter household name: "My Test House"
- [ ] Click "Create"
- [ ] Expected: New household created successfully

### Test Add Expense
- [ ] Go to /expenses
- [ ] Fill in form:
  - Amount: "50.00"
  - Date: Today's date
  - Description: "Test Expense"
- [ ] Click "Add Expense"
- [ ] Expected: "Expense added successfully!" message

### Test Dashboard
- [ ] Go to / (home page)
- [ ] You should see an overview
- [ ] Click "Households" in navigation
- [ ] Expected: See your dashboard

---

## Phase 6: Ready to Develop

- [ ] Project structure explored
- [ ] Database working
- [ ] Auth flow tested
- [ ] Core features verified
- [ ] Start building!

---

## 📁 Important Directories

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js pages and layouts |
| `src/modules/` | Business logic services |
| `src/actions/` | Server actions for mutations |
| `src/components/` | Reusable UI components |
| `src/db/schema/` | Database table definitions |
| `src/lib/` | Utilities and configuration |

---

## 📚 Project Documentation

After setup, read these files in order:

1. **README.md** - Overview and features
2. **PROJECT_SUMMARY.md** - What was built
3. **QUICKREF.md** - Developer quick reference
4. **IMPLEMENTATION.md** - Detailed setup guide

---

## 🐛 Troubleshooting

### PostgreSQL Connection Error
```
Error: DATABASE_URL environment variable is not set
```
**Solution**: Ensure DATABASE_URL is in `.env.local` and has correct format

### Supabase Auth Error
```
Error: Missing Supabase environment variables
```
**Solution**: Verify NEXT_PUBLIC_SUPABASE_URL and key are in `.env.local`

### Database Migration Error
```
Error: Failed to apply migration
```
**Solution**: 
1. Check PostgreSQL is running
2. Verify DATABASE_URL connects successfully
3. Delete `src/db/migrations/` and retry

### Port Already in Use
```
Error: Port 3000 is already in use
```
**Solution**: 
```bash
# Kill the process or use different port
npm run dev -- -p 3001
```

---

## ✅ You're All Set!

Your Home Budget Tracker is now ready to use!

### Next Steps:
1. **Explore the code** - Understand the architecture
2. **Read QUICKREF.md** - Learn the patterns
3. **Add new features** - Extend the application
4. **Deploy** - Get it live on Vercel

---

## 📝 Quick Commands Reference

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production

# Database
npm run db:generate        # Generate migration
npm run db:migrate         # Apply migrations
npm run db:studio          # Open Drizzle Studio

# Code Quality
npm run lint               # Run linter
npm run format             # Format code

# Deployment
npm run build && npm start # Test production build
```

---

## 🎯 Success Indicators

✅ All of these should be working:

- [ ] npm install - No errors
- [ ] npm run db:generate - Migration created
- [ ] npm run db:migrate - Tables created
- [ ] npm run dev - Server starts on port 3000
- [ ] http://localhost:3000 - Homepage loads
- [ ] /auth/signup - Sign up works
- [ ] /auth/login - Login works
- [ ] /households - Household creation works
- [ ] /expenses - Expense form works
- [ ] / - Dashboard loads

---

## 🚀 Ready to Deploy?

When you're ready to go live:

1. Push to GitHub
2. Connect Vercel to GitHub
3. Set environment variables in Vercel
4. Deploy!

See IMPLEMENTATION.md for detailed deployment guide.

---

**Start Date**: April 12, 2026  
**Setup Time**: ~45 minutes  
**Status**: Ready to build! 🎉
