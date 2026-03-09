# Plaid Integration Setup Guide

This guide walks you through every manual step needed to get Plaid working with Helm.

---

## Step 1: Create a Plaid Account

1. Go to **https://dashboard.plaid.com/signup**
2. Sign up with your email (use a personal or business email)
3. Verify your email
4. You'll land on the Plaid Dashboard

**Important:** You'll start in **Sandbox** mode, which is free and uses test credentials. No real bank data is involved until you apply for Production access.

---

## Step 2: Get Your API Keys

1. In the Plaid Dashboard, go to **Developers > Keys** (or **https://dashboard.plaid.com/developers/keys**)
2. You'll see three sets of keys:
   - **client_id** — same across all environments
   - **Sandbox secret** — for testing
   - **Development secret** — for real banks with limited users (optional, for later)
   - **Production secret** — for launch (requires application approval)
3. Copy the **client_id** and **Sandbox secret**

---

## Step 3: Add Keys to Your Environment

Open your `.env.local` file in the project root and add:

```env
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET_SANDBOX=your_sandbox_secret_here
PLAID_ENV=sandbox
```

If `.env.local` doesn't exist yet, copy from the example:
```bash
cp .env.local.example .env.local
```
Then fill in the values.

---

## Step 4: Run the Database Migration

The Plaid integration adds a new `plaid_items` table to track connections. You need to run migration `013_create_plaid_items.sql` in your Supabase project.

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `supabase/migrations/013_create_plaid_items.sql` from this project
5. Copy the entire contents and paste it into the SQL Editor
6. Click **Run** (or Ctrl+Enter / Cmd+Enter)
7. You should see "Success. No rows returned." — that means it worked

### Option B: Via Supabase CLI

If you have the Supabase CLI installed:
```bash
supabase db push
```

### Verify the Migration

In the Supabase Dashboard, go to **Table Editor**. You should see a new `plaid_items` table with these columns:
- `id`, `user_id`, `plaid_item_id`, `plaid_access_token`
- `institution_id`, `plaid_institution_id`, `institution_name`
- `status`, `error_code`, `error_message`
- `available_products`, `billed_products`, `consented_products`
- `transactions_cursor`, `last_transactions_sync`, `last_balances_sync`, `last_holdings_sync`
- `webhook_url`, `consent_expiration`
- `created_at`, `updated_at`

---

## Step 5: Configure Plaid Dashboard Settings

1. In the Plaid Dashboard, go to **Developers > Webhooks**
2. For now, leave this empty (webhooks are only needed when you deploy to a public URL)
3. When you deploy to production, set the webhook URL to: `https://yourdomain.com/api/plaid/webhook`

### Allowed Redirect URIs (for OAuth banks)

Some banks use OAuth flows. In the Plaid Dashboard:
1. Go to **Developers > API** (or the settings page)
2. Under **Allowed redirect URIs**, add:
   - `http://localhost:3000` (for local dev)
   - `https://helmterminal.dev` (for production)

---

## Step 6: Test the Integration

1. Start your dev server:
   ```bash
   npm run dev
   ```
2. Log in to Helm and go to the **Accounts** page
3. Click **Add Account**
4. Click **Connect with Plaid**
5. The Plaid Link modal will open

### Sandbox Test Credentials

In Sandbox mode, Plaid provides test credentials. When the Link modal asks for login:

- **Username:** `user_good`
- **Password:** `pass_good`

Other test users you can try:
| Username | Password | Behavior |
|----------|----------|----------|
| `user_good` | `pass_good` | Successful connection with checking, savings, credit card |
| `user_good` | `pass_good` | Select any institution — they all work in sandbox |
| `user_transactions_dynamic` | `pass_good` | Generates new transactions on each sync |

After connecting, you should see:
- New accounts appear in the Accounts page
- Balances are populated
- The "Sync All" button will pull transactions

---

## Step 7: Verify Data Synced

After linking an account in Sandbox:

1. **Check Supabase Table Editor:**
   - `plaid_items` should have 1 row with `status: 'active'`
   - `linked_accounts` should have new rows with `plaid_account_id` populated
   - `transactions` should have rows after clicking "Sync All"

2. **Check the Helm dashboard:**
   - Accounts page should show the newly linked accounts with real (sandbox) balances
   - Portfolio page should show holdings if you linked a brokerage account

---

## Architecture Overview

Here's how the pieces fit together:

```
User clicks "Connect with Plaid"
        |
        v
POST /api/plaid/create-link-token
        |
        v
Plaid Link opens (Plaid's hosted UI)
        |
        v
User selects bank, enters credentials
        |
        v
Plaid returns public_token to frontend
        |
        v
POST /api/plaid/exchange-public-token
  - Exchanges public_token for access_token
  - Stores access_token in plaid_items table
  - Creates linked_accounts for each account
  - Fetches initial balances
        |
        v
User clicks "Sync All"
        |
        v
POST /api/plaid/sync
  - Fetches current balances from Plaid
  - Uses transactions/sync for incremental transaction updates
  - Syncs investment holdings (if brokerage account)
  - Updates all local tables
```

### Webhook Flow (Production)

When deployed with a public URL:
```
Plaid detects new transactions
        |
        v
POST /api/plaid/webhook
  - Logs the event
  - Marks the item as needing sync
        |
        v
Next sync picks up new data
```

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `lib/plaid.ts` | Plaid SDK client configuration and helper functions |
| `app/api/plaid/create-link-token/route.ts` | Creates a Link token for the Plaid Link UI |
| `app/api/plaid/exchange-public-token/route.ts` | Exchanges public token, stores connection, creates accounts |
| `app/api/plaid/sync/route.ts` | Syncs balances, transactions, and holdings from Plaid |
| `app/api/plaid/webhook/route.ts` | Handles Plaid webhook events (errors, updates) |
| `components/plaid/plaid-link-button.tsx` | Frontend button that opens Plaid Link |
| `supabase/migrations/013_create_plaid_items.sql` | Database table for Plaid connections |

### Modified Files
| File | Change |
|------|--------|
| `app/dashboard/accounts/page.tsx` | Replaced "Coming Soon" with working Plaid Link; sync now calls Plaid |
| `.env.local.example` | Added Plaid env vars as active (not commented) |
| `package.json` | Added `plaid` dependency |

---

## Troubleshooting

### "Failed to create link token"
- Check that `PLAID_CLIENT_ID` and `PLAID_SECRET_SANDBOX` are set in `.env.local`
- Restart your dev server after changing env vars
- Check the server console for detailed error messages

### Plaid Link opens but immediately closes
- Make sure `PLAID_ENV=sandbox` is set
- Check browser console for JavaScript errors

### Accounts don't appear after linking
- Check Supabase Table Editor > `plaid_items` — is there a row?
- Check `linked_accounts` — are new rows present?
- Look at the server console for error messages during the exchange

### "Sync All" doesn't pull transactions
- In Sandbox, transactions are simulated. Click Sync and check the `transactions` table in Supabase
- The sync endpoint uses Plaid's incremental `transactions/sync` — first sync may take a moment

### Webhook errors in production
- Ensure your webhook URL is publicly accessible (not localhost)
- Plaid webhooks require HTTPS
- Check the Plaid Dashboard > Developers > Webhooks for delivery status

---

## Next Steps After Plaid Is Working

Once you've verified the Sandbox integration works:

1. **Apply for Development access** in the Plaid Dashboard to test with real banks (up to 100 Items)
2. **Apply for Production access** when ready to launch (requires company verification)
3. **Set up webhooks** so data syncs automatically without the user clicking "Sync"
4. **Add a scheduled sync** via Supabase Edge Functions to refresh balances daily
5. **Build the Transactions page** (`/dashboard/transactions`) to display synced transaction data
