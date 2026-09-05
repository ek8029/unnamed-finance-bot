# Agent presence: options, not a build (2026-09-05)

Question: a surface that shows what the agent is doing, has done, and will do next, interactively, without inventing a new landing page. Could live in the brief.

What exists today (all in production):
- `/api/agent/worklog` + `<AgentWorklog>`: real per-user rows from the crons (sync, price, read, scan, flag, brief), zero LLM, 72h window. Rendered only on `/dashboard/brief`.
- `<AgentHeartbeat>`: "watching N theses · last scan 9:15". Theses page.
- `<FirstRead>`: the harvestable-loss dollar in the seconds after a brokerage connects.
- Forward data already computed: `earningsThisWeek` (ticker, date, weight), pillar `breaks_if` on new theses, the single daily cron at 9:15 ET, watchlist thresholds.
- The number that shapes everything: about 5 judged evidence rows a day across 250 users. Most days, for most people, the LLM part of the agent changes nothing. "Read 41 sources on your 12 names, nothing moved" has to be a designed state, not an empty one.

Taste constraints already decided: no glow, no count-up, no greeting, no decision inbox (homework), ghost shells never empty states, mono labels + gold accent, instrument-panel direction on mobile (every number on a scale, no cards), honest motion (real timestamps, never fake pacing), thesis is one line among exposure, taxes, earnings and the brief.

## The frame: three tenses on one spine

Every option below is one of three tenses. The strongest version is one spine that carries all three, not three widgets.

| Tense | What it answers | Data today |
|---|---|---|
| Done | what happened to my book since I last looked | worklog, pillar_evidence, insights, investigations, snapshots |
| Now | is Helm on, what is it watching, how fresh is this number | linked_accounts, portfolio_performance.calculated_at, market_prices timestamps, theses count |
| Ahead | what will it do, when, and what would change what | earnings dates, breaks_if, EDGAR expected filings, cron time, watchlist thresholds |

## Option A. The Ledger (the brief becomes the log)

The brief page stops being prose with a worklog bolted above it and becomes a dated ledger with the prose as one entry.

```
OVERNIGHT                                          ran 9:15 · 41 sources · 24 positions
09:15  priced 24 positions                         book 412,900  +0.4%
09:15  read 3 filings, 38 articles on 12 names     nothing moved a pillar
09:16  concentration                               NVDA 31% · unchanged
09:16  tax                                         4,120 harvestable · 3 lots
09:17  wrote your brief                            ↓ below

AHEAD
Thu    AMD reports                                 18% of book · re-read after the call
Nov 4  NVDA 10-Q expected                          tests "data-center margin" pillar
tmrw   next full read                              9:15 ET

THE BRIEF
[existing digest prose]
```

- Interaction: any line expands to its receipt. "read 3 filings" opens the three document titles with dates; "nothing moved a pillar" opens the pillar list with last-scored times; "4,120 harvestable" opens the lots. Receipts are the interactivity, not animation.
- Data: all of it exists. AHEAD needs one new query joining earnings dates to holdings weights (already done for `earningsThisWeek`) plus `breaks_if` text per pillar per ticker.
- Cost: zero LLM. The digest prose is already generated.
- Why it is tasteful: the agent shows up as a record, the way a bank statement shows up. Quiet days read as calm because every line still has a number.
- Risk: log fatigue if lines are padded. Rule: a line exists only when a real row exists. Dedupe by kind per run.

## Option B. The Watch Strip (present tense, ambient, everywhere)

One thin mono line at the top of the overview and the brief, replacing the theses-only heartbeat.

```
watching 24 positions · 12 names · 3 theses   read 9:15 today   next 9:15 tomorrow   2 earnings this week   0 flags
```

- Each segment is a link: positions → holdings, names with earnings → earnings, flags → actions.
- Data: exists. `next` is computed from the cron schedule, not promised by an LLM.
- Cost: zero. One request, cached per user per run.
- Why: it answers "is this thing on" without a hero. It is the instrument-panel answer. On mobile it becomes the header's second line.
- Risk: none if the numbers are real. Never show it when `linked_accounts` is empty; show the unlinked variant ("watching 1 thesis · connect to watch your book").

## Option C. Live Read (future tense made visible, at connect and on demand)

The `FirstRead` screen generalised: a streamed read of the whole book, lines appearing as the real work completes.

```
CONNECTED · READING                                    started 14:02:11
14:02:11  Fidelity found · 2 accounts
14:02:19  24 positions in
14:02:20  priced 24 · 3 from yesterday's close
14:02:20  NVDA is 31% of the book
14:02:21  3 earnings in the next 30 days · AMD Thu
14:02:21  4,120 harvestable across 3 lots
14:02:22  Helm already covers 6 of your 12 names        adopt →
14:02:40  read 12 filings against those 6                nothing contradicts today
          Tomorrow 9:15 I read all of it again.
```

- Interaction: lines are links to the surfaces they describe. A "Read now" button on the overview reruns it on demand. Free: 3 a week. Pro: unlimited. This is the instant-scan gate from the July ladder, which shipped as a feature but never as a gate.
- Data: every deterministic line exists as an API today (first-read, insights rules, earnings, synthesis coverage). The "read 12 filings" line is the only LLM step and the only one that costs money; it can be limited to house-covered names where evidence already exists (zero new LLM) and say so.
- Timing rule: lines print when the work finishes, with real timestamps. If sync takes three minutes the screen shows three minutes of "positions arriving 8 / 24". That is the fix for a connector leaving at "still coming in".
- Why: the agent introduces itself by working, in the first 60 seconds, on their money.
- Risk: theatre. No line may be scheduled for effect. If a step has no result it prints its zero.

## Option D. Receipts on numbers (presence through provenance)

No feed at all. Every headline number carries a provenance line and a tap-through.

```
412,900
priced 9:15 · 24 positions · 3 stale
```
Tap: which three, from where, when they last priced, what Helm will do about it (re-price at 9:15).

- Data: exists (market_prices timestamps, snapshot times, holdings sources).
- Cost: zero.
- Why: this is Helm's own doctrine ("every finding cites its source") applied to the numbers. The agent is felt as "how I know", not "look what I did". Pairs with A or B rather than replacing them.
- Risk: visual noise if applied to every figure. Headline numbers only: net worth, day change, harvestable, concentration.

## Option E. Ahead panel ("what I am watching for")

A standalone forward panel on the overview, if the Ledger's AHEAD block is not enough.

```
AHEAD
Thu     AMD earnings        18% of book      re-score data-center pillar after the call
Mon     next 10-Q window    NVDA, AVGO       margin pillars re-read on filing
daily   9:15 read           all 24           flags only if something moves
>3%     watchlist           SPY QQQ TLT      alert if it moves this much
```

- Data: earnings and cron exist; expected filing windows need EDGAR's historical cadence per ticker (`lib/earnings-edgar.ts` has the pieces); `breaks_if` gives the "what would change" text.
- Cost: zero LLM.
- Rule: nothing goes in AHEAD that the crons do not actually do. A promised re-score that never runs is worse than no panel.

## Option F. Since you were here (diff on return)

On any return visit the overview opens with a mono header "since Tue 4:12pm" and the diff: price moves on held names, new evidence rows, new flags, positions that changed.

- Data: `last_seen` exists; evidence and insights are timestamped; price diffs are the weak point because snapshots are one upserted row per user with no history (see project_snapshot_timing_unverifiable). Evidence and flag diffs are solid; price diffs are not until a scheduled close write exists.
- Cost: zero.
- Why: it is the worklog scoped to the person's absence instead of the cron's window.
- Risk: only helps once someone returns. The five same-day leavers never do; this is for the email's click-through, not for the leak.

## Option G. The email carries the ledger

The morning email's first block is the three DONE lines and the first AHEAD line, then the prose. Not a screen. Reaches 250 people a day at zero cost.

## Recommendation

Not seven things. One system with three parts, in this order:

1. B, the Watch Strip. Cheapest, everywhere, present tense. Half a day.
2. A, the Ledger. Restructure the brief around the worklog with AHEAD added and receipts on expand. Two days. G falls out of it for free (same data, three lines).
3. C, Live Read. Generalise FirstRead, add the on-demand button and the free/Pro gate. Three days. This is the one that touches the connect moment and the paywall.

D is polish to apply inside A and C, not a separate build. E is A's AHEAD block; only split it out if the brief gets long. F waits for a real snapshot history.

## What not to do

- First-person chatter on every screen. The record speaks; the agent does not narrate.
- Fake pacing, staggered reveals with no work behind them, spinners that mean nothing.
- Padding quiet days with LLM prose to make the agent look busy. The honest quiet line is the product.
- A separate "Agent" tab. Presence belongs on the pages people already open.
- Any line in AHEAD that the crons do not literally perform.

## Open questions for Evan

- Does the brief become the ledger (A), or does the ledger sit above the brief as today with AHEAD added? The first is the bigger change and the better page.
- "Read now" free allowance: 3 a week, or 1 a day?
- Should the strip show on the marketing homepage in demo form (it would be a real screenshot of presence)?

## Revision (same day, Evan: "we already have a lot of strips on the overview")

Correct. The overview top already stacks `AgentHeartbeat` (theses only), `TodaysDelta` ("what changed since you last looked", which is Option F, already built), `SectorHeatStrip`, then `AgentFirstLook` (deterministic findings after connect, dismissable) below the hero. Three agent voices on one page before the fold.

So: Option B is withdrawn as an addition. Zero new strips on the overview. Revised shape:

- Overview: subtract, then annotate. Delete `AgentHeartbeat` (theses-only, duplicates the delta line). Fold the present tense into the caption that already exists under net worth: "Net worth · 24 positions · priced 9:15 · next read 9:15 tomorrow" (Option D on one number, no new element). Keep `TodaysDelta` as the single Done line. Fold `AgentFirstLook` into `TodaysDelta`'s first-visit form so there is one voice, not two.
- Brief: Option A, the Ledger. The page that is meant to be the record becomes the record. AHEAD lives here, not on the overview.
- Connect: Option C replaces `FirstRead`, not a strip.

Net element count on the overview goes down by one or two. Presence-as-page lives on /brief; presence-as-caption lives on the overview; presence-as-event lives at connect.
