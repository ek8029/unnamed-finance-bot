# Manual Steps — Post-Deploy Checklist

After pushing these changes, complete the following steps in order.

---

## 1. Run the Waitlist Migration in Supabase

The waitlist table needs to be created in your Supabase database.

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New query**
4. Paste the contents of `supabase/migrations/018_waitlist.sql`:

```sql
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES waitlist(referral_code) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read waitlist entries"
  ON waitlist FOR SELECT
  USING (true);
```

5. Click **Run** (or Ctrl+Enter)
6. Verify: go to **Table Editor** and confirm the `waitlist` table appears

---

## 2. Button Variant Change — Review Existing Usage

The default button variant changed from gold to platinum. If any existing component relies on `variant="default"` (or no variant) being gold, update it to `variant="accent"`.

Quick check — search your codebase for buttons that should stay gold:
- Dashboard CTAs that link to important actions
- Any "primary action" buttons that were intentionally gold

To make a button gold, add `variant="accent"`:
```tsx
<Button variant="accent">Primary Action</Button>
```

---

## 3. Add Analytics (Choose One)

### Option A: Plausible (privacy-focused, simpler)

1. Sign up at [plausible.io](https://plausible.io)
2. Add your domain: `helmterminal.dev`
3. Open `app/layout.tsx`
4. Add inside the `<head>` section (or before closing `</body>`):

```tsx
<Script
  defer
  data-domain="helmterminal.dev"
  src="https://plausible.io/js/script.js"
/>
```

5. Add the import at the top:
```tsx
import Script from 'next/script';
```

### Option B: PostHog (more features, session replay)

1. Sign up at [posthog.com](https://posthog.com)
2. Create a project and get your API key
3. Install: `npm install posthog-js`
4. Create `lib/posthog.ts`:

```ts
import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  posthog.init('YOUR_POSTHOG_KEY', {
    api_host: 'https://us.i.posthog.com',
  });
}

export default posthog;
```

5. Import in your root layout or a client provider component

---

## 4. Verify After Deploy

After deploying to Vercel:

- [ ] Visit `helmterminal.dev` — confirm new landing page renders
- [ ] Submit a test email to the waitlist — confirm position + referral code appear
- [ ] Visit `helmterminal.dev/robots.txt` — confirm it loads
- [ ] Visit `helmterminal.dev/sitemap.xml` — confirm it loads
- [ ] Check the OG image: paste `helmterminal.dev` into Twitter/Slack/Discord and verify the preview card
- [ ] Visit `/login` and `/signup` — confirm no gold glow behind form cards
- [ ] Test the favicon in browser tabs

---

## 5. Optional: Waitlist Admin View

To check waitlist signups, go to Supabase **Table Editor** > `waitlist`. You can:
- See all signups with positions and referral codes
- Filter by `referred_by` to see referral chains
- Export as CSV from the table editor

You could also query directly:
```sql
SELECT email, position, referral_code, referred_by, created_at
FROM waitlist
ORDER BY position ASC;
```
