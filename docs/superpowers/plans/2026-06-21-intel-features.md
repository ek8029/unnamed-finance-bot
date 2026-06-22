# Intelligence Features (Factor Lens, Thesis Screener, Thesis Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add three features inspired by quantlink.ai, retail-ized for Helm's conviction-investor ICP: (1) a portfolio Factor Lens, (2) a Thesis-native Screener, (3) a pre-buy Thesis Builder.

**Architecture:** All three reuse existing infra (holdings + securities, the thesis layer tables/APIs, analyze-stock cache, cross-thesis-risk, ProBlur/tier gating, Card/status-chip design system). No new cron, no schema changes required. Factor metrics are read from the existing `analysis_cache` + `securities` + on-demand `getFullTickerData`/`financials`, never a new backfill job (keeps API cost down).

**Tech Stack:** Next 16 App Router, Supabase, existing libs. TS. Verify via `npx tsc --noEmit` + `npm run build` (no test framework).

**Branch:** `feat/intel-features`.

**IA (decided, grounded in `app/dashboard/layout.tsx` nav array lines ~80-98):**
- Factor Lens → `/dashboard/portfolio/factors` (add "Factor Lens" to the Portfolio nav item's `children`). Pro-gated via `requirePro`/`ProBlur`.
- Screener → `/dashboard/screener` (new top-level nav item, icon from lucide e.g. `SlidersHorizontal`). Gated `hasThesisAccess`.
- Builder → `/dashboard/theses/builder` (+ entry button on `/dashboard/theses`, + CTA on public `/analyze/[ticker]`). Gated `hasThesisAccess`.

---

## Shared conventions (all tasks)
- Match design system: `Card` (`@/components/ui/card`, variants default/elevated/glass), status colors from `lib/thesis-palette.ts` / `components/thesis/status-chip.tsx` (intact #4ADE80, weakening #E6B94D, broken #F87171, unverified #808080), tokens `--color-bg-surface/elevated`, `--color-text-primary/secondary/muted`, `--color-gold`, `--font-mono`.
- Gating: server pages use `hasThesisAccess(userId,email)` (lib/thesis-access-server.ts) or `requirePro(userId)` (lib/tier.ts); client uses `useTier()` / `isThesisUser`; wrap blurred content in `<ProBlur>`.
- NO em dashes anywhere. Commit per feature. Do NOT push.

---

## FEATURE 1 — Factor Lens (`/dashboard/portfolio/factors`)

### Task 1.1: Factor computation lib (pure, cheap)
**Files:** Create `lib/factor-lens.ts`

- [ ] **Implement** a pure module that, given the user's holdings (ticker, sector, total_value, allocation %, day_change_pct, unrealised_gain_loss_pct) plus best-effort per-ticker metrics (marketCap, peRatio, pbRatio, roe, debtToEquity, beta) sourced from `analysis_cache`/`securities`/`getFullTickerData` (read-only, prefer cached; DO NOT force fresh AI generation), classifies each holding on lightweight factors:
  - size: marketCap bucket (mega >200B, large 10-200B, mid 2-10B, small <2B)
  - value/growth tilt: P/E or P/B vs a simple threshold (low PE/PB = value)
  - momentum: trailing return sign/magnitude (use unrealised_gain_loss_pct, or trailing return from market_prices if cheap)
  - quality: ROE / debt-to-equity (high ROE + low D/E = quality)
  - rate-sensitivity: sector proxy map (REITs, Utilities, Financials = high; Tech growth = high-duration)
  - sector: securities.sector
- [ ] Aggregate to PORTFOLIO level (value-weighted): overall tilt summary (e.g. "large-cap, growth-leaning, high-momentum, tech-concentrated"), per-factor weights, sector weights, and a "today's move driver": correlate holdings' day_change_pct with their factor buckets to name which factor/sector most explains the day. Return a typed `FactorReport`.
- [ ] Mark any holding with missing metrics as `coverage: partial` and exclude from the metric-dependent aggregates (be honest about coverage; surface a "N of M holdings classified" note).
- [ ] Verify `npx tsc --noEmit` EXIT 0. Commit `feat(factors): factor-lens computation lib`.

### Task 1.2: API route
**Files:** Create `app/api/factor-lens/route.ts`
- [ ] GET: auth user, `requirePro` (return 403 if not), fetch holdings (mirror `/api/holdings`), gather cached metrics, call `lib/factor-lens`, return `FactorReport`. Use `.maybeSingle()` never `.single()`.
- [ ] Verify tsc. Commit `feat(factors): factor-lens API`.

### Task 1.3: Page + nav
**Files:** Create `app/dashboard/portfolio/factors/page.tsx`; Modify `app/dashboard/layout.tsx` (add "Factor Lens" to Portfolio children).
- [ ] Client page: fetch `/api/factor-lens`; render with `Card`s: (a) headline tilt sentence, (b) factor-weight bars (size/value/momentum/quality/rate-sens), (c) sector allocation, (d) "what moved you today" callout, (e) per-holding factor table. Wrap in `<ProBlur label="Unlock Factor Lens with Pro">` when `!isPro`. Coverage note visible.
- [ ] Add nav child `{ name: 'Factor Lens', href: '/dashboard/portfolio/factors' }` under the Portfolio item.
- [ ] Verify `npm run build` EXIT 0; route appears. Commit `feat(factors): factor lens page + nav`.

---

## FEATURE 2 — Thesis Screener (`/dashboard/screener`)

### Task 2.1: Screener data API
**Files:** Create `app/api/screener/route.ts`
- [ ] GET: auth, `hasThesisAccess` gate. Query the user's theses + pillars (reuse the pattern in `app/api/thesis` / `lib/thesis-summary.ts`) and compute per-thesis `{ ticker, convictionBand (strong/holding/review), score, intactCount, totalCount, worstPillarStatus, brokenCount, weakeningCount, sector (join securities), clusterDriver (from thesis_clusters) }`. Include the shared-driver clusters from `thesis_clusters`.
- [ ] Return `{ rows: ScreenerRow[], clusters: SynthCluster[] }`. Verify tsc. Commit `feat(screener): screener API`.

### Task 2.2: Screener page + nav
**Files:** Create `app/dashboard/screener/page.tsx`; Modify `app/dashboard/layout.tsx` (new top-level nav item).
- [ ] Client page: fetch `/api/screener`. A filterable/sortable table (reuse the theses standings table styling) with FILTERS: conviction band, has-broken-pillar, has-weakening-pillar, sector, cluster. Plus quick views: "Breaking now" (any broken/weakening), "By cluster" (group rows under shared-driver). Each row links to `/dashboard/theses` (the detail). Empty state when user has < 2 theses: explain the screener gets useful as you track more, link to the Builder.
- [ ] Add top-level nav `{ name: 'Screener', href: '/dashboard/screener', icon: SlidersHorizontal }`, gated like Theses (render only when thesis access).
- [ ] Verify `npm run build` EXIT 0. Commit `feat(screener): screener page + nav`.

---

## FEATURE 3 — Thesis Builder (`/dashboard/theses/builder`)

### Task 3.1: Pre-buy risk helper
**Files:** Create `lib/prebuy-risk.ts`
- [ ] Pure-ish helper: given a candidate ticker + the user's current holdings + theses, compute: (a) sector concentration if added (current sector weight, and projected), reusing holdings + securities.sector; (b) shared-driver overlap with existing theses (reuse `lib/cross-thesis-risk.ts` / `thesis_clusters` synthesis given the candidate's draft pillars); (c) pull the bear case from `analyzeStock(ticker, false)` (cached, no forced gen). Return `PrebuyRisk`.
- [ ] Verify tsc. Commit `feat(builder): pre-buy risk helper`.

### Task 3.2: Builder page (reuse existing thesis APIs)
**Files:** Create `app/dashboard/theses/builder/page.tsx`; create `app/api/prebuy-risk/route.ts` (GET, hasThesisAccess, wraps lib/prebuy-risk).
- [ ] Page flow (reuse existing endpoints, do NOT add new thesis-write APIs): ticker input -> `POST /api/thesis/seed {ticker}` to draft pillars -> show proposed pillars (editable) + the pre-buy risk panel (`/api/prebuy-risk`) showing concentration + shared-driver + bear case -> user confirms/edits/dismisses pillars via `PATCH /api/thesis/pillars/[id]` -> "Track this thesis" (`POST /api/thesis` + set tracked). Make clear this is for names you are researching, not necessarily own.
- [ ] Verify `npm run build` EXIT 0. Commit `feat(builder): pre-buy thesis builder page + risk API`.

### Task 3.3: Entry points
**Files:** Modify `app/dashboard/theses/page.tsx` (add a "Build a thesis" button -> /dashboard/theses/builder); Modify `app/analyze/[ticker]/page.tsx` (add a "Build a thesis on {TICKER}" CTA linking to `/dashboard/theses/builder?ticker={TICKER}` — public acquisition hook, routes through login if needed).
- [ ] Builder reads `?ticker=` query param to prefill.
- [ ] Verify `npm run build` EXIT 0. Commit `feat(builder): entry points from theses + analyze`.

---

## Done criteria
- `/dashboard/portfolio/factors` shows a real factor breakdown of the user's holdings (Pro-gated), honest about coverage.
- `/dashboard/screener` filters the user's theses by conviction/status/cluster/sector (thesis-gated).
- `/dashboard/theses/builder` drafts pillars for any ticker + shows pre-buy risk, reusing existing APIs (thesis-gated); entry from /theses + /analyze.
- tsc + build green. No em dashes. No new cron. No forced AI generation (cost-safe).

## Out of scope
- No factor backfill cron (read cached/on-demand only).
- No new thesis-write APIs (reuse seed/create/pillars).
- Public SEO screener (future).
