# Supabase Database Setup

This directory contains all SQL migrations for the Helm backend.

## Quick Start

### Step 1: Apply Migrations to Supabase

You have two options to apply these migrations:

#### Option A: Supabase Dashboard (Recommended for first-time setup)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of each migration file **in order** (001 → 012)
5. Click **Run** for each migration
6. Verify success (you should see "Success. No rows returned")

**Migration Order (IMPORTANT - Run in this exact order):**
1. `001_create_users_and_preferences.sql` ✓
2. `002_create_institutions_and_accounts.sql` ✓
3. `003_create_transactions_and_categories.sql` ✓
4. `004_create_liabilities.sql` ✓
5. `005_create_securities_and_holdings.sql` ✓
6. `006_create_portfolio_snapshots.sql` ✓
7. `007_create_market_data.sql` ✓
8. `008_create_tax_management.sql` ✓
9. `009_create_insights_engine.sql` ✓
10. `010_create_financial_health.sql` ✓
11. `011_create_sync_jobs.sql` ✓
12. `012_create_rls_policies.sql` ✓

#### Option B: Supabase CLI (For advanced users)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Step 2: Verify Tables Created

After running all migrations, verify in the Supabase Dashboard:

1. Go to **Table Editor**
2. You should see 30+ tables including:
   - `user_profiles`
   - `user_preferences`
   - `institutions`
   - `linked_accounts`
   - `transactions`
   - `holdings`
   - `securities`
   - `insights`
   - And many more...

### Step 3: Verify RLS Policies

1. Go to **Authentication** → **Policies**
2. Each user-owned table should have RLS enabled with policies like:
   - "Users can view own [table]"
   - "Users can insert own [table]"
   - etc.

## Database Schema Overview

### Core Domains

1. **Identity & Access** - User profiles and preferences
2. **Financial Accounts** - Banks, brokerages, crypto accounts
3. **Transactions** - Transaction history and cash flow
4. **Liabilities** - Debts, loans, credit cards
5. **Portfolio** - Holdings, securities, snapshots
6. **Market Data** - Prices, news, SEC filings
7. **Tax Management** - Estimates, capital gains, optimization
8. **Insights** - AI-generated financial intelligence
9. **Financial Health** - Net worth and health scoring
10. **System Operations** - Sync jobs and audit logs

### Row-Level Security (RLS)

All user-owned tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Public reference data (securities, market prices) is readable by all
- Service role bypasses RLS for admin operations

## Next Steps After Migration

1. **Seed Reference Data**
   - Run seed scripts to populate institutions and transaction categories
   - Located in `/scripts/seed-*.ts`

2. **Create Test User**
   - Use Supabase Auth to create a test user
   - Test RLS policies by querying tables

3. **Test API Routes**
   - API routes will be created in `/app/api/`
   - They will use the Supabase client to query these tables

## Troubleshooting

### Error: "relation already exists"
- This means you've already run a migration
- Skip that migration or drop the table first

### Error: "permission denied"
- Check your service role key in `.env.local`
- Verify you're using the correct Supabase project

### Error: "syntax error"
- Ensure you copied the entire migration file
- Check for any copy/paste issues

## Schema Changes

To modify the schema in the future:
1. Create a new migration file: `013_your_change.sql`
2. Follow the same naming convention
3. Apply via SQL Editor or CLI
4. Update TypeScript types accordingly
