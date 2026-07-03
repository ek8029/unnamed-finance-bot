# Agentic Value Ladder — MASTER SPEC (2026-07-03)

The single doc for the two-week program. Council verdict implementation: make a
brand-new user see real agent value at minute 1 / day 1 / week 1, honestly, and
convert at a schedulable moment. 7 items. Everything builds on existing code;
no new pipelines. Supersedes/absorbs `2026-07-02-watch-my-tickers.md` (full
detail inlined at item 4).

Principle threaded through all of it: **the product's one promise is "when we
alert, it's real."** Trust items ship before funnel items point at them.

## The funnel this program builds

```
AI citation / earned mention / X catch / SEO
        ↓
/analyze/[ticker] or /thesis/[ticker]  (public, no login)
        │        └─ reasoning-trace card = minute-1 proof (item 5)
        ↓
"Watch my tickers" — email + 5 tickers, no account (item 4)
        │  digest only-when-something-happened = the habit Noah never formed
        ↓
Signup → thesis-first onboarding: FOLLOW a house thesis,
        inherit its dated catch history w/ honest provenance (item 6)
        ↓
Plaid connect → INSTANT SCAN: TLH + shared exposure, real dollars
        in 40 seconds — headline free, detail gated (item 7)
        ↓                            = the deterministic paywall
Paid. Retention = event catches on own holdings + weekly quiet-is-good digests.

Prereq for pointing traffic at ANY of it: items 1-3 (trust batch) —
scorer credibility, one TLH number everywhere, zero fake/broken numbers.
```

---

## WEEK 1 — trust + ship

### 1. Scorer FIX B — weakening requires convergence (~½ day)

**Problem:** 11/18 demo theses read "weakening" off 1 contradict among 40
supports. Smoke detector that never stops beeping.

**Where:** `lib/thesis-status.ts` `derivePillarStatus` — line ~53:
`if (recentMaterialContradictions.length >= 1) return 'weakening'`.

**Change:** weakening requires **≥2 recent material contradictions from
independent sources** (reuse the `distinctKeys` independence machinery already
used for broken), OR 1 material contradiction from a PRIMARY source (filing/
form4/xbrl — a 10-Q line deserves a flag; one news article does not). Keep the
severe-primary→broken and 2-independent+primary→broken rules unchanged.

**New state for the single-news-contradict case:** nothing visible. It stays
`intact` with the contradict logged in the evidence trail (visible on expand).
Honest: noted, not alarmed.

**Verify:** unit tests in the existing thesis-status suite (add cases: 1 news
contradict → intact; 1 filing contradict → weakening; 2 independent news →
weakening). Demo account rescore → expect ~2-4/18 weakening. Update
`scripts/audit-demo.ts` expectations.

### 2. Trust-killer batch (~1 day)

a. **TierLock fake preview** — `app/dashboard/theses/page.tsx:456` hardcodes
   "14 of 16 pillars intact" behind the paywall blur. Replace with REAL
   aggregate from the house universe (e.g. live count from public thesis data:
   "Helm is watching 38 theses · N pillars"), or the user's own draft count.
   Rule: no invented numbers anywhere, including previews.
b. **"What Helm Did" dupes** — `components/thesis/agent-activity.tsx` renders
   duplicate entries (same AVGO/JPM/PLTR items 2-3x). Root cause in the
   insights write path (same event inserted per-run without an idempotency
   key) or the feed query (missing distinct). Fix at WRITE: dedupe key
   (user_id, source_type, related_entity_ids, title, day) checked before
   insert in the agentic pipelines; plus a one-off cleanup of existing dupes.
c. **Theses count mismatch** — footer "18 of 18 confirmed" next to
   "DRAFT ALL (19)": one counter includes drafts, the other doesn't. Single
   source: count from the same filtered set.
d. **Transactions "—" amounts** — every bank/card row shows "—" while the
   day-group header shows a real total. Locate the amount field mapping in
   the transactions page (likely `amount` vs `transaction_amount` mismatch or
   sign-filter). If data is genuinely absent for manual/demo rows, render
   nothing gracefully but fix the demo data so rows carry amounts.
e. **Wrapped sparkline markers** — `app/dashboard/wrapped/page.tsx` downsample
   drops best/worst dates → markers vanish. Force-include marker dates in the
   filter (`i % step === 0 || isMarkerDate(i) || last`).

### 3. TLH unification (~1 day)

**Problem:** three surfaces, three formulas: brief = capped (gains offset +
$3k) × 32%; PRIM action = min(loss, 3000) × 32% (wrong: caps before gains
offset); insights headline = uncapped loss × 32%.

**Target:** ONE function is the source of truth: `generateTaxReport`'s capped
math in `lib/tax-analysis.ts` (fix its known internal nit: apply LT/ST-aware
rate to the gains-offset portion, not flat 32%). Then:
- `lib/insights-engine.ts` Rule 3: headline + description use
  `report.totalEstimatedSavings` (capped); keep the carryforward sentence.
- `lib/thesis-actions.ts` harvest action: per-position savings = position's
  share of the report's capped savings (`positionLoss / totalLoss ×
  totalEstimatedSavings`), not an independent min(loss,3000) formula.
- `lib/intelligence-feed.ts`: already reads the report — copy fixed earlier.

**Verify:** one probe script asserts the same dollar number appears on
brief/actions/taxes for test@; add unit test on the per-position share.

### 4. Ship Watch My Tickers (~½ day) — BUILT, full detail inlined

The no-account middle step of the funnel: email + up to 5 tickers; Helm emails
only when evidence lands. Solves activation (no bank login), habit (inbox is
where Noah said the product failed to live), and paywall timing (warm until a
catch on their own name).

**Data:** `watch_subscriptions` (migration 047): email, tickers[1..5]
(validated against INDEXABLE_TICKERS), confirm_token/confirmed_at (double
opt-in), unsub_token/unsubscribed_at (one-click, CAN-SPAM), last_digest_at.
Unique on lower(email); RLS on, no policies (service-role only).

**Capture:** `WatchTickersCard` on `/analyze/[ticker]` + `/thesis/[ticker]`
(prefilled with page ticker; chip entry for more). `POST /api/watch/subscribe`
— email-domain validation + signup rate-limit chain (IP/domain/global, fails
open in dev); upsert by email (re-subscribe replaces tickers, revives
unsubscribed); Resend confirm email. `GET /api/watch/confirm?token=` →
`/watch/confirmed` (create-account CTA). `GET /api/watch/unsub?token=` →
`/watch/unsubscribed`.

**Digest (in the existing 9:15 daily cron, `sendWatchDigests`):** per confirmed
sub, per ticker: approved catches since last_digest_at from `content_queue` →
`content_events` (8-day window, one query for all subs). Send ONLY if
something happened; Friday = guaranteed roundup ("quiet week — that is the
product working"). Template: verbatim quote + source link per ticker, quiet
list, signup CTA (email prefilled), unsubscribe footer. Full verbatims always
— the quote is the trust builder, never teased.

**Upgrade path:** every digest + confirmed page → `/signup?email=…`; on signup
match by email → seed user watchlist with their tickers (v1.1).

**Out of scope v1:** non-house tickers get moves/headlines only (no fake
theses); per-sub personalization; send-time optimization.

**Remaining to ship:**
1. Evan pastes `supabase/migrations/047_watch_subscriptions.sql` (SQL editor).
2. Commit feature files (kept out of the fix pushes deliberately): lib/watch.ts,
   app/api/watch/*, components/watch-tickers-card.tsx, app/watch/*, templates
   additions, cron hook, the card wiring in analyze + thesis pages, migration.
3. E2E localhost: subscribe on /analyze/NVDA → confirm link → force digest
   (script calling `sendWatchDigests`) → inspect email HTML.
4. Push + promote with the rest of week-1.

**KPIs:** capture rate on public pages (target 2-5% of visitors), confirm rate
(>60%), digest open (>40%), email→signup conversion (decides if this becomes
the primary funnel).

---

## WEEK 2 — the value ladder

### 5. Reasoning-trace card (~2 days)

**What:** one visual causal chain for a catch: **verbatim quote (dated,
sourced) → pillar it hit → status flip → conviction delta → proposed action.**
The minute-1 artifact. No staged demo; assembled from real rows.

**Data:** all exists — `content_events` (public catches: quote/verdict/
pillar_claim/date/url) for house theses; `pillar_evidence` + `thesis_pillars`
+ insights (actions tagged related_entity_ids) for user theses.

**Component:** `components/thesis/reasoning-trace.tsx`, two variants:
- `public` — renders from a PublicCatch + house pillar; conviction delta
  computed from `computePillarStatus` before/after (lib/content/thesis-status).
- `user` — renders from evidence row + pillar + linked action insight.

**Surfaces (in order):** `/thesis/[ticker]` (top catch gets the trace treatment
— this page is where AI-referred visitors land), demo account theses page,
Actions Inbox expanded view. Design: vertical timeline, mono eyebrows, gold
accents, verbatim in serif quote style (matches thesis-breach email + masthead
language). Draw-on animation fine; respect prefers-reduced-motion.

**Metric:** % of public /thesis visitors who scroll/interact with the trace;
demo→signup rate.

### 6. Thesis-first onboarding: FOLLOW / FORK adoption (~2-3 days)

**Flow (new route `/dashboard/theses/adopt`, also the post-signup default):**
1. "Which of these do you own?" — house-universe ticker grid (38), multi-pick,
   plus free-text ticker for off-universe (gets a fresh draft thesis, no
   inheritance — honest).
2. Per picked house ticker, show the house thesis (pillars + recent catches) →
   **FOLLOW** (one click): user tracks Helm's thesis verbatim. History rendered
   with provenance: "Helm's NVDA thesis · watched since May 2026 · N catches".
   Evidence stays keyed to house pillars; user's thesis row gets
   `source='house'` + `house_ref` columns (small migration 048).
   **FORK**: edit pillars; a pillar keeps its inherited evidence ONLY if its
   claim text is unchanged; edited/new pillars start `unverified` with fresh
   accrual. Provenance label switches to "forked from Helm's thesis".
3. Plaid ask comes AFTER at least one thesis is followed — connection now has
   a stated purpose ("link your account so catches map to your real position
   size and tax lots").

**Hard rule from council:** never present inherited history as the user's own.
No "backdated conviction" language anywhere. The banned phrase list gets it.

**Touches:** migration 048 (theses.source, theses.house_ref), adopt route +
UI (reuses public thesis rendering), score-theses must skip re-scoring
followed-verbatim theses (read house evidence instead — dedupe LLM cost),
onboarding redirect after signup.

**Metric:** signup→first-followed-thesis rate; followed→Plaid-connect rate
(the cohort measure the GTM verdict demanded).

### 7. Connect-moment instant scan (~1-2 days)

**The deterministic paywall.** On Plaid connect success (existing initial-sync
completion path), run immediately and present as "the agent's first 40 seconds
on your book":
- TLH scan — `generateTaxReport` (capped math from item 3): "$X in harvestable
  losses across N positions."
- Shared-exposure scan — existing `lib/cross-thesis-risk.ts` clustering against
  followed theses + holdings: "3 positions ride one driver."
- Concentration — existing rule (SPY 26% style).

**Presentation:** full-screen "scan" interstitial after connect (progressive
reveal, real numbers as they compute), then a summary card pinned on Overview.
**Gating:** headline numbers FREE (trust: real, checkable). Detail + proposed
actions + investigation gated: TLH detail = Pro, agent actions/investigation =
Max. CTA copy: "See the full work-through."

**Touches:** post-sync hook (where initial holdings sync completes), an
interstitial component, gate via existing requirePro/requireMax.

**Metric:** connect→scan-view→upgrade-click funnel (PostHog events:
`scan_viewed`, `scan_upgrade_clicked`).

---

## Cross-cutting

- **Instrumentation:** per-ticker catch frequency (content_events group by
  ticker/week) — sets digest expectations + paywall-timing data.
- **Banned-phrase gate stays:** all new copy advice-safe (no buy/sell/should);
  verbatim quotes exempt.
- **Pricing flag (not this sprint):** if minute-1 value is free and the agent
  is Max, Pro thins out. Revisit tiers with conversion data from item 7.
- **Cut list (council):** orchestration loop, new pipelines, Wrapped work,
  public thesis-grading (Expansionist's open lane — logged as the NEXT big
  swing after this ladder proves out).

## Order + gates

1 → 2 → 3 (trust) must merge before 5 → 6 → 7 point traffic at those surfaces.
4 (watch) ships as soon as migration is pasted — independent.
Item 7 depends on 3 (one TLH number) and benefits from 6 (followed theses make
shared-exposure non-empty), so it goes last.
