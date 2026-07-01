# Spec: Wrapped — Top 3 Best & Worst Days

**Requested by:** Ben (first paying customer, EJ advisor, referral-chain origin) 2026-06-30.
**Ask:** show a portfolio's top 3 best and worst days in Wrapped, on a % and $ basis.

## Goal
Add a Wrapped slide listing the 3 best and 3 worst market days of the period, each with
a dollar change and a percent change. Delight the highest-leverage user; reinforce the
"your year, in review" story with a concrete, screenshot-worthy stat.

## Data (already available — no new query)
`generateWrapped(period)` already fetches, into `snapshots` (ascending by date):
`portfolio_snapshots(snapshot_date, total_value, total_cost_basis, total_gain_loss, total_gain_loss_pct)`
scoped to the Wrapped period. Best/worst days are derived from this array.

## Metric basis (DECISION A — recommend gain_loss)
Day change = delta of **`total_gain_loss`** between consecutive snapshot rows:
- `changeDollars = gl[t] - gl[t-1]`
- `changePct = (gl[t] - gl[t-1]) / total_value[t-1] * 100`
- date label = `snapshot_date[t]` (the later day).

Why `total_gain_loss` not raw `total_value`: a deposit inflates `total_value` and would
fake a "best day." `total_gain_loss` (unrealized P/L) is deposit-immune — cost basis rises
with a deposit, so the gain_loss delta reflects market move only. This keeps the stat honest.
Known minor: a realized sell can jump gain_loss; acceptable for a Wrapped highlight.

## Compute
New helper in `lib/portfolio-wrapped.ts`:
```
type WrappedDay = { date: string; changeDollars: number; changePct: number };
function computeBestWorstDays(snapshots): { bestDays: WrappedDay[]; worstDays: WrappedDay[] }
```
- Walk consecutive rows, build a delta per adjacent pair.
- `bestDays` = deltas sorted desc, take up to 3 with changeDollars > 0.
- `worstDays` = deltas sorted asc, take up to 3 with changeDollars < 0.
- Weekends/gaps: absent rows just mean no delta; a multi-day gap is labeled by the later
  date (rare, acceptable). No dedup needed (best set is positive, worst is negative).

Wire into `generateWrapped`: call the helper on the already-fetched `snapshots`, add
`bestDays` + `worstDays` to the returned `WrappedData`. Extend the `WrappedData` interface.

## Empty / sparse handling (DECISION B — recommend show-what-exists)
- 0 deltas (<2 snapshots): both arrays empty → slide is HIDDEN entirely.
- 1-2 qualifying days: show what exists (do not pad).
- Rationale: most connected users with history (Ben) get a full list; brand-new accounts
  simply don't see the slide rather than seeing a thin/embarrassing one.

## UI
Add to `app/dashboard/wrapped/wrapped-performance-cards.tsx` (lives with best/worst
*position*, natural neighbor). One slide, two stacked mini-lists:
- "Your best days" — up to 3 rows, each: date · +$X · +Y% (green #4ADE80).
- "Your worst days" — up to 3 rows, each: date · -$X · -Y% (red #F87171).
- Match existing Wrapped card visual system (Manrope/Space Grotesk, gold accents, dark).
- Render nothing if both arrays empty (gate at the slide level).

## Demo (so it renders for the seeded investor account + /wrapped/demo)
Add `bestDays`/`worstDays` to the demo Wrapped payload (`app/wrapped/demo/wrapped-demo.tsx`
and/or `lib/demo-data.ts`) with plausible values, so the demo and the seeded account both
show the slide.

## Out of scope (v2)
- Share card / OpenGraph image inclusion (`components/wrapped/share-card-canvas.ts`) —
  defer unless trivial after v1.
- Per-holding attribution of the best/worst day ("driven by NVDA +6%") — nice later, needs
  `holdings_snapshot` blob parsing.

## Verify (localhost)
1. Log into a connected account with history (or the seeded test@ account) → Wrapped shows
   the slide with real ranked days, $ and % both present, signs correct.
2. Deposit-day sanity: a known deposit day is NOT listed as a best day.
3. Brand-new / no-history account → slide hidden, no crash.
4. Demo Wrapped (/wrapped/demo) shows the slide.

## Open decisions for Evan
- A: metric basis — `total_gain_loss` delta (recommended, honest) vs raw `total_value` delta.
- B: sparse handling — show-what-exists + hide-if-empty (recommended) vs hard 3-day gate.
- C: share-card inclusion now or v2 (recommended v2).
