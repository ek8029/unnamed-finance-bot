# Watch My Tickers — spec (2026-07-02)

> **SUPERSEDED 2026-07-03:** merged into
> `2026-07-03-agentic-value-ladder.md` (item 4) — the master spec for the
> two-week agentic value-ladder program. This file kept for history.

## Why (GTM context)

The funnel today is signup → Plaid → 85% bounce. Noah's churn reason ("couldn't fit it into daily finance work") says the product must come TO the user. This flow inserts a zero-risk middle step: **email + tickers, no account, no Plaid**. Helm then shows up in their inbox when evidence lands. Habit built passively; Plaid asked only after Helm has proven it reads filings for them; paywall moment moves to "a catch on MY ticker."

Positioning line the flow embodies: **"You don't check Helm. Helm checks for you."**

## Current flow (what this slots into)

- `/analyze/[ticker]` — 510 indexed public pages, top of funnel from SEO/AI citations. CTA today: "Open the terminal" (signup).
- `/thesis/[ticker]` — living thesis pages w/ dated catches.
- Signup = full Supabase auth → dashboard → Plaid ask (the cliff).
- Email infra: Resend (`lib/emails/resend.ts`), templates pattern (`lib/emails/templates.ts`), drip log dedupe, daily 9:15 ET cron.
- Evidence per ticker: `content_events` (approved catches, house universe), `market_news`, quotes.

## v1 scope

### Data
`watch_subscriptions` (new migration 047):
- `id uuid pk`, `email text not null`, `tickers text[] not null` (1-5, uppercased, validated)
- `confirm_token uuid default gen_random_uuid()`, `confirmed_at timestamptz`
- `unsub_token uuid default gen_random_uuid()`, `unsubscribed_at timestamptz`
- `created_at`, `last_digest_at timestamptz`
- unique on (lower(email)); RLS on, no policies (service-role only)

### Capture
- `WatchTickersCard` client component on `/analyze/[ticker]` (below the analysis, above signup CTA) and `/thesis/[ticker]`. Prefilled with page's ticker; user can add up to 5 total (comma/enter entry, validated against known-ticker list used by analyze).
- Copy: "Helm reads the filings so you don't have to. Get an email when something changes on your tickers. No account needed."
- `POST /api/watch/subscribe` — validates email (`lib/email-validation`), tickers; Upstash IP rate limit (reuse signup-protection helpers, lighter tier); upsert by email (re-subscribe = replace tickers, re-send confirm if unconfirmed); sends confirm email via Resend.
- Double opt-in: `GET /api/watch/confirm?token=` → sets confirmed_at → redirect `/watch/confirmed` (page with "what happens next" + create-account CTA).

### Digest ("the watchman email")
- Runs inside existing daily 9:15 ET cron (no new Vercel cron): for each confirmed, non-unsubscribed sub:
  - per ticker: approved catches since last_digest_at (`content_events`), day move if |>3%| (existing quote path), latest headline (market_news).
  - **Send-only-if-something-happened** + guaranteed Friday roundup ("quiet week on your tickers: that is the product working"). This IS the positioning: interrupt only when it matters.
- Template: `getWatchDigestTemplate` in templates.ts — catches with verbatim quote + source link, move lines, footer CTA "See the full picture — create your free account" (email prefilled) + one-click unsubscribe (`/api/watch/unsub?token=`, CAN-SPAM).
- `last_digest_at` updated per send; drip-log-style dedupe not needed (timestamp is the dedupe).

### Upgrade path
- Every digest + confirmed page: signup link `/signup?email=...`. On signup, if watch_subscriptions row matches the email → seed the user's watchlist with their tickers (one-line hook in signup flow or first-login), then mark row `converted_at` (col optional v1: skip, match by email later).

## Out of scope v1
- Arbitrary-ticker thesis generation (catches only exist for house universe; non-house tickers get moves+headlines only — honest, no fake theses).
- Per-subscriber personalization beyond tickers; A/B; automation of send-time.

## Anti-abuse
Double opt-in + IP rate limit + email validation + tickers whitelist. No captcha v1 (email-only, low value target); add hCaptcha if abuse observed.

## KPIs
Capture rate on /analyze (target 2-5% of visitors), confirm rate (>60%), digest open (>40%), email→signup conversion (the number that decides if this becomes the primary funnel).

## Verify
- Unit: subscribe validation, confirm/unsub token flows, digest gather logic (vitest).
- Manual on localhost: subscribe on /analyze/NVDA → confirm link → force-run digest → email rendered (Resend test mode / log HTML).
