# Helm Backend Setup Guide

This guide will help you set up the complete Helm backend infrastructure.

## Prerequisites

✅ Supabase project created
✅ `.env.local` configured with Supabase credentials
✅ Node.js and npm installed

---

## Step-by-Step Setup

### Step 1: Apply Database Migrations

You need to create all the database tables by running the 12 SQL migration files.

**Option A: Supabase Dashboard (Recommended)**

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste each migration file **in order** (001 → 012)
5. Click **Run** for each one
6. Verify success (you should see "Success. No rows returned")

**Migration files location:** `/supabase/migrations/`

**Order matters!** Run them in this exact sequence:
1. `001_create_users_and_preferences.sql`
2. `002_create_institutions_and_accounts.sql`
3. `003_create_transactions_and_categories.sql`
4. `004_create_liabilities.sql`
5. `005_create_securities_and_holdings.sql`
6. `006_create_portfolio_snapshots.sql`
7. `007_create_market_data.sql`
8. `008_create_tax_management.sql`
9. `009_create_insights_engine.sql`
10. `010_create_financial_health.sql`
11. `011_create_sync_jobs.sql`
12. `012_create_rls_policies.sql`

---

### Step 2: Verify Tables Created

After running all migrations:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see 30+ tables including:
   - `user_profiles`, `user_preferences`
   - `institutions`, `linked_accounts`
   - `transactions`, `transaction_categories`
   - `securities`, `holdings`
   - `insights`, `tax_estimates`
   - And many more...

---

### Step 3: Seed Reference Data

Now populate the reference tables with data:

```bash
# Seed all reference data
npm run db:seed

# Or seed individually:
npm run db:seed:institutions  # Banks, brokerages, crypto exchanges
npm run db:seed:categories    # Transaction categories
```

This will populate:
- **17 financial institutions** (Chase, Fidelity, Coinbase, etc.)
- **45+ transaction categories** (Groceries, Salary, Rent, etc.)

---

### Step 4: Verify Seeded Data

Check that data was inserted:

1. In Supabase Dashboard, go to **Table Editor**
2. Open `institutions` table → should see 17 rows
3. Open `transaction_categories` table → should see 45+ rows

---

### Step 5: Create a Test User

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User**
3. Choose **Email** method
4. Enter:
   - Email: `test@helm.app` (or any email)
   - Password: Create a secure password
   - Email Confirm: ✅ Checked (auto-confirm)
5. Click **Create User**
6. Copy the **User ID** (UUID) for later use

---

### Step 6: Test Database Access

Create a simple test to verify everything works:

```bash
# This will test your Supabase connection
tsx scripts/test-supabase-connection.ts
```

Expected output:
```
✅ Successfully connected to Supabase!
```

---

## What You Have Now

✅ **Complete Production Database Schema**
- 30+ tables with proper relationships
- Row-Level Security (RLS) enabled on all user tables
- Indexes for performance
- Public reference data (institutions, securities, categories)

✅ **Reference Data Seeded**
- 17 financial institutions
- 45+ transaction categories
- Ready for user data

✅ **Supabase Client Configured**
- Browser client for Client Components
- Server client for Server Components/API Routes
- Environment variables set up

---

## Next Steps

Now that your database is set up, the next phase is:

### Phase 1B: Build the Service Layer & API Routes

1. **Service Layer** - Create data access functions
   - `lib/services/accounts.service.ts`
   - `lib/services/holdings.service.ts`
   - `lib/services/insights.service.ts`
   - etc.

2. **API Routes** - Build Next.js API endpoints
   - `app/api/financial-summary/route.ts`
   - `app/api/accounts/route.ts`
   - `app/api/holdings/route.ts`
   - `app/api/insights/route.ts`
   - etc.

3. **Authentication Pages**
   - `app/login/page.tsx`
   - `app/signup/page.tsx`
   - Protected route middleware

4. **Frontend Integration**
   - Update components to fetch from API
   - Add loading & error states
   - Remove mock data dependencies

---

## Troubleshooting

### Error: "relation already exists"
You've already run that migration. Skip it or drop the table first.

### Error: "permission denied"
Check your `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### Error: "Missing Supabase environment variables"
Make sure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Seed scripts fail
1. Verify migrations ran successfully
2. Check that tables exist in Supabase
3. Verify your service role key is correct

---

## Database Schema Reference

See `/supabase/README.md` for detailed schema documentation.

---

## Need Help?

- Check Supabase logs in Dashboard → Logs
- Review migration files for table structure
- Verify RLS policies in Dashboard → Authentication → Policies

---

**Ready to continue?** Let me know when migrations are applied and I'll help build the service layer and API routes!
