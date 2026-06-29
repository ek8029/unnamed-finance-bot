# Spec: The Masthead — Per-Ticker Living Thesis Pages + Permanent Catch Archive

Date: 2026-06-28
Status: approved for build (Evan directed implement + test + audit; review on localhost)

## Why

Two goals converge into one system:
1. Make the homepage CTA **"Read the thesis on any ticker"** honest. Today it points to `/analyze/[ticker]`, a one-shot AI snapshot. Helm's wedge is a *living, maintained* thesis that updates and breaks. The CTA must land on a persistent thesis with a current verdict and cited evidence.
2. Turn the daily catch pipeline into a **publishing / distribution engine** that feeds Helm's proven acquisition channel (AI-citation). Each ticker's thesis page is a permanent, dated, cited, daily-refreshing artifact LLMs preferentially cite.

ICP note: this serves the confirmed self-directed retail ICP (and the advisor-as-power-user instance). Not a B2B pivot. See `memory/project_advisor_signal_is_icp_confirmation.md`.

## Non-negotiables (from Evan)

- **No hardcoding.** Thesis text comes from the authored `HOUSE_THESES`; all evidence and dates come from the DB; pillar/thesis status is **computed**, never hand-set per ticker. No sample/demo numbers on these pages.
- **The math must be correct and deterministic.** Pillar status is a documented function of real evidence. Same inputs → same output. Auditable.
- **The pipeline must work end to end.** Cron → events → approval → page render, with the persistence fix so the archive is actually permanent.
- RIA-safe framing throughout: "the public thesis and its evidence / what to watch," never "buy/sell/should." Mirror the existing `/caught` disclaimer posture.

## Data model (established, do not re-derive)

- `HOUSE_THESES` (static, `lib/content/house-theses.ts`): 40 tickers, each `{ ticker, company, pillars: { id, claim, breaks_if }[] }`. `getHouseThesis(ticker)` is the "has a standing thesis" test.
- `content_events` (catch/evidence): `id, run_date, ticker, company, pillar_id, pillar_claim, verdict ('supports'|'contradicts'), verbatim_cite, cite_date(timestamptz), source_url, source_type ('filing'|'major_news'|'minor_news'), summary, newsworthiness, created_at`. RLS enabled, no policies → **service-role reads only**. `pillar_id` links a catch to a `HOUSE_THESES` pillar.
- `content_queue` (approval state, 1:1 via `event_id` UNIQUE, ON DELETE CASCADE): `status ('draft'|'approved'|'rejected')`, `decided_at`, copy fields. **Visibility gate = `status='approved'`** (always join through the queue; never read `content_events` raw for public).
- Public read client: `createStaticServiceClient()` (cookie-free, ISR-safe) from `lib/supabase/server.ts`.
- Cron `/api/cron/content` (21:30 UTC Mon–Fri) writes drafts; manual approve at `/admin/content`.
- **Existing gotcha to fix:** cron hard-deletes `content_events` where `run_date < now-45d`. That destroys the archive. See Persistence Fix.

## Scope

### 1. Per-ticker living thesis page — `/thesis/[ticker]`

The primary indexable, AI-citable unit. Rich, updating, one per house-thesis ticker.

Renders (all from real data):
- Header: company, ticker, **computed thesis health** (one of: Intact / Watch / Weakening / Broken), as-of date (latest evidence date), "last checked" (latest `run_date`).
- Per pillar (from `HOUSE_THESES[ticker].pillars`):
  - `claim` (the reason to own), `breaks_if` (the falsifier).
  - **Computed pillar status** (Intact / Weakening / Broken / Unverified) with the rule below.
  - The pillar's catches, newest first: `verdict` chip, `verbatim_cite` (the quote), `summary`, `source_type` label (SEC filing / News), dated (`cite_date ?? run_date`), `source_url` link (new tab, rel noopener). Each catch has a stable anchor `#c-<event.id>`.
- "Research, not investment advice" disclaimer; "what to watch" framing.
- CTA into signup ("watch your own {ticker} thesis") + link to `/caught` (the feed) + `/analyze/[ticker]` (the snapshot).
- JSON-LD: `Article` (or `Dataset`) describing the thesis, plus a `Claim`/`itemListElement` per pillar with the cited evidence as `citation`. Dated (`dateModified` = latest evidence date). No fabricated aggregate stats.
- ISR `revalidate = 1800` (match `/caught`).
- Indexable iff `getHouseThesis(ticker)` exists AND ticker ∈ INDEXABLE policy; else `noindex`.

Fallback: `getHouseThesis(ticker)` undefined → `redirect('/analyze/' + ticker)` (the snapshot path). No empty thesis pages.

Empty evidence: a real house thesis with zero approved catches yet → render the thesis + pillars with status `Unverified` and an honest "No filings have tested this thesis since monitoring began" line. Never invent evidence.

### 2. Permanent catch archive (persistence fix)

- Each catch is addressable as `/thesis/[ticker]#c-<id>` (anchor on the rich page). **No dedicated per-catch route** — single-quote pages are thin/doorway content and an SEO liability. The rich per-ticker page is the citable unit; individual catches are anchors + RSS items + structured-data citations.
- **Persistence fix (required):** modify the cron expiry so it only deletes **non-approved** events older than 45d. Approved catches are the published record and must persist:
  ```
  delete from content_events
  where run_date < (now - 45d)
    and id not in (select event_id from content_queue where status = 'approved')
  ```
  (Implement via two-step: select approved event_ids, delete events older than 45d not in that set. Or add a guard in the cron delete.) Drafts/rejected still expire. This makes the archive compound instead of evaporating.

### 3. Feed + discovery

- `/caught` (existing): keep as the chronological front page; each catch links to its `/thesis/[ticker]#c-<id>`. Relax/keep the 30d display window (the feed stays recent; the thesis pages hold the full history).
- **`app/sitemap.ts`**: add a `/thesis/[ticker]` entry for every `HOUSE_THESES` ticker, `lastModified` = latest evidence date for that ticker (or thesis authored date if none).
- **RSS** `/caught/rss.xml` (or `/thesis/rss.xml`): the approved catches as a feed (title = `{ticker}: {verdict} — {pillar claim}`, content = verbatim cite + summary + source link, pubDate = cite_date??run_date, guid = event id, link = `/thesis/[ticker]#c-<id>`). Forwardable + crawlable.

### 4. CTA wiring

- The Masthead "Read the thesis on any ticker" input and the homepage analyze CTAs resolve a submitted symbol to `/thesis/[SYMBOL]` when `getHouseThesis(SYMBOL)` exists, else `/analyze/[SYMBOL]`. A tiny server route or client check on submit (the page itself already redirects to /analyze on miss, so the input can always push to `/thesis/[SYMBOL]` and let the page fall back). Simplest: input always navigates to `/thesis/[SYMBOL]`; the thesis page redirects to /analyze when no house thesis. One code path, always correct.

## The math — pillar status computation (the core, must be exact)

Module: `lib/content/thesis-status.ts` (pure, unit-testable, no I/O).

Inputs per pillar: the chronological list of that pillar's approved catches, each `{ verdict, dateISO (cite_date??run_date, YYYY-MM-DD), source_type }`.

Constants (documented, tunable in one place, not scattered):
- `SOURCE_WEIGHT = { filing: 3, major_news: 2, minor_news: 1 }` (matches the pipeline's existing source weighting).
- `VERDICT_SIGN = { supports: +1, contradicts: -1 }` (neutrals never persist).
- `HALF_LIFE_DAYS = 120` (recency decay; a catch's weight halves every 120 days).
- `WINDOW_DAYS = 365` (ignore evidence older than a year for *current* status; still shown in history).
- Thresholds on the recency-weighted net score `S`:
  - no catches in window → `Unverified`
  - `S >= +0.5` → `Intact`
  - `-0.5 < S < +0.5` → `Watch` (mixed/aging; some contradiction or only weak/old support)
  - `-1.5 < S <= -0.5` → `Weakening`
  - `S <= -1.5` → `Broken`
- **Override rule (recency dominance):** if the single most-recent catch in the window is `contradicts` from a `filing`, status is at least `Weakening` (a fresh primary-source contradiction can't read as Intact even if older supports outweigh it). Documented and applied after the score bucket; take the more-severe of (bucketed status, Weakening).

Computation:
```
now = today (UTC)
for each catch c in window (dateISO within WINDOW_DAYS):
    ageDays = now - c.date
    decay = 0.5 ** (ageDays / HALF_LIFE_DAYS)
    contribution = VERDICT_SIGN[c.verdict] * SOURCE_WEIGHT[c.source_type] * decay
S = sum(contribution) / NORMALIZER
```
`NORMALIZER = SOURCE_WEIGHT.filing = 3` so a single fresh filing-grade catch maps to ±1.0 and the thresholds above are in intuitive "filing-equivalents." Document this so the thresholds are legible.

Thesis-level health = worst pillar status by severity order `Broken > Weakening > Watch > Intact > Unverified`, with a tie-aware label:
- any `Broken` → `Broken`
- else any `Weakening` → `Weakening`
- else any `Watch` → `Watch`
- else all `Intact` (≥1) → `Intact`
- else → `Unverified`

This is fully determined by data. With the current DB (13 catches, all `supports`), every pillar with evidence computes `Intact`, pillars without evidence compute `Unverified` — which is honest and matches reality (no breaks exist yet).

Edge cases the math must handle (and tests must cover):
- pillar with zero catches → Unverified (not Intact, not error).
- all supports, recent → Intact.
- one fresh filing contradiction among older supports → Weakening (override).
- only old (>365d) support → Unverified (out of window).
- mixed recent supports+contradicts → Watch or Weakening per score.
- division/normalizer never divides by zero (NORMALIZER is constant 3).

## Files (planned)

- `lib/content/thesis-status.ts` — pure compute (status, health, labels, constants). + colocated unit tests `lib/content/thesis-status.test.ts` (vitest).
- `lib/content/public-thesis.ts` — server data layer: `getTickerThesisData(ticker)` → joins house thesis + approved catches (via content_queue), buckets by pillar_id, computes statuses. Uses `createStaticServiceClient`. Returns a typed object or null.
- `app/thesis/[ticker]/page.tsx` — the page (server component, ISR 1800, generateMetadata, JSON-LD, noindex policy, redirect fallback).
- `app/thesis/[ticker]/loading.tsx` — skeleton.
- `app/caught/rss.xml/route.ts` — RSS feed (or `app/thesis/rss.xml/route.ts`).
- `app/sitemap.ts` — add `/thesis/[ticker]` for all house-thesis tickers.
- `app/api/cron/content/route.ts` — persistence fix (don't delete approved).
- CTA wiring: `components/homepage/masthead-home.tsx` (Try-it → `/thesis/[SYMBOL]`), and the live homepage analyze CTAs if desired.
- `app/caught/page.tsx` — link each catch to `/thesis/[ticker]#c-<id>` (pull `pillar_id`/`id`/`ticker` into the select).

## Testing (required before audit)

1. **Unit tests** for `thesis-status.ts` covering every edge case above — `npx vitest run lib/content/thesis-status.test.ts`.
2. **Real-data integration:** run `getTickerThesisData` against the live DB for (a) a ticker with approved catches (verify pillar bucketing + Intact), (b) a house-thesis ticker with no catches (Unverified, no crash), (c) a non-house ticker (null → redirect path). Confirm numbers match a hand-computation from the raw rows.
3. **Render:** load `/thesis/PLTR` (or whichever has catches), `/thesis/<no-catch house ticker>`, `/thesis/<random ticker>` on localhost; verify no hardcoded values, real quotes, correct dates, working source links, JSON-LD valid, fallback redirect.
4. **Pipeline:** confirm the cron persistence fix keeps approved events past 45d (logic test / dry-run query), drafts still expire.
5. `npx tsc --noEmit` clean; no console errors; mobile + desktop.

## Audit (after tests pass)

Adversarial pass over: math correctness (recompute by hand vs code on real rows), no-hardcoding (grep for literal statuses/numbers), RLS/visibility (no unreviewed catches leak), RIA framing (no advice language), SEO (no thin/doorway pages, valid schema, noindex policy correct), perf (query count, ISR), date/timezone correctness (UTC slicing), and the persistence fix (approved truly survive). Produce a findings list; fix; re-verify. Then hand to Evan for localhost review.

## Out of scope (note, don't build now)

- Email "Masthead Daily" send (separate, later).
- Authoring new house theses (content task).
- Dedicated per-catch routes (intentionally avoided — thin content).
- A/B vs the current homepage (no statistical power at current traffic).
