# Onboarding v3: book first, one reveal, then the terminal

Date: 2026-09-08. Status: design, approved direction (variant C of `/testing/onboarding-lab`).
Owners: Astra builds the surfaces; Codex owns `app/dashboard/dashboard-shell.tsx` and
`app/dashboard/portfolio/page.tsx`, which section 6 touches. Coordinate before editing those.

## 1. Why

Measured 9/8 (PostHog, 90-day signup cohort n=96, internal excluded; DB probe n=247):

- A book (Plaid or manual) returns 50% at two days; no book 15%; demo only 9% (0% at seven days).
- Day-one breadth does not hurt: 5+ dashboard routes 29% return, 1–2 routes 18%. 60 of 71
  no-book users saw two routes or fewer. They left at the door, not from overwhelm.
- The current v2 flow loses people at every step between the scan card and the book:
  card 122 → reasons shown 53 → thesis adopted 30 → link started 26 → link completed 13.
  Thesis-adopt on its own retains 24% / 8%.
- Manual entry: one start in 60 days, zero accounts since the 9/4 fix, yet manual books
  retained like Plaid books while the form was broken. The credential-free path is hidden.
- Return destination days 2–14: the brief (11 of ~20 returners), then Portfolio, Actions.
- Plaid: 42 starts → 11 completed. 16 closed the picker, 10 `institution_not_found`.

So: the ask comes first, manual is co-equal, every screen after the ask is about the
user's own book, thesis adoption waits for the brief, demo is removed.

## 2. Scope

In: the flow below, its events, the Portfolio empty state, sidebar dimming, the brief promise.
Out: pricing, the paywall, push notifications, iOS (separate spec), the brief's content.

## 3. Flow

```
signup ─► [1 Ask] ─► [2 Loop] ─► [3 Reveal] ─► /dashboard/portfolio (real)
              │                                      │
              └─ manual ──┘                          └─ unlocks arrive with the first brief
```

Three screens, full-bleed overlay over the dashboard like v2, `helm-terminal` skin. Progress:
three hairline segments. Any screen can be left with "Do this later"; leaving lands on the
Portfolio empty state (section 6), never on a blank terminal.

### Screen 1: Ask. "Start with what you own."

Two panels at equal visual weight (same card, same height, same button style).

**Connect a brokerage.** Copy: "Read-only. Helm can see positions and balances and can
never trade, move money or see your login." Six shortcut chips (Fidelity, Schwab, Robinhood,
Vanguard, E*TRADE, Interactive Brokers) and "Search all brokerages". Every control opens
Plaid Link (`components/plaid/plaid-link-button.tsx`). Three trust rows under the chips.
Open item: whether a chip can open Link pre-pointed at an institution; check Plaid's current
Link docs before build. If not, chips open Link's search. No closed list, ever.

**Or add the positions you hold.** Copy: "Three to five tickers is enough. No credentials,
no account numbers. Connect a brokerage later to import the rest." Uses the existing
`ManualPortfolioForm` in compact mode and `POST /api/portfolio/manual`, which is idempotent
per `requestId` (deterministic holding ids; a retry never duplicates a lot).

Exits from Link, handled on this screen:
- `institution_not_found` → focus the manual panel with a one-line notice carrying the name
  the user typed: "{name} is not available through Plaid yet. Add those positions by hand;
  you keep every feature." Fire `onb3_plaid_exit {reason}`.
- Picker closed / credentials abandoned → stay on the screen, manual panel unchanged.
- Success → screen 2. The Plaid sync runs in the background exactly as today.

### Screen 2: Loop. "Is that all of it?"

Shows the accounts on record (institution, type, position count, imported / entered by hand)
and the same shortcut chips minus the ones already linked. Copy for one account: "Most people
who pay for Helm hold accounts at two or more brokerages. Add the others and the exposure
view shows the overlap between them." For two or more: "{n} accounts, {positions} positions,
{value}. Add another, or continue." Primary: "Show me what Helm sees". Secondary: "You can
add accounts any time from Accounts." Manual entry is reachable here too (same compact form).

### Screen 3: Reveal. "Here is your book, read."

Two cards side by side (stacked under 860px).

**What you actually own.** Top five names by total exposure, each bar split into held
directly and inside funds, then one sentence: "{T} is {p}% of your book: {d}% held directly,
{i}% inside {funds}, across {n} accounts. No single brokerage screen shows that number."
Data: the existing look-through behind the True Exposure view. Confirm which module before
build; do not write a second one.

**The reason you hold {T}, checked.** The v2 scan card's data path (`getTickerThesisData`)
on the largest position: verdict chip, pillar, verbatim quote, source and date, link to the
filing. Outside the covered names, the honest fallback verbatim from v2: "No filing has moved
{T} in the last 90 days." Never a fabricated verdict.

Primary: "Open the terminal" → `/dashboard/portfolio`. Under it: "The brief on these
positions lands at 9:15 ET tomorrow."

## 4. What is removed from v2

The scan-first card as the entry (it becomes a reveal on the user's largest holding), the
`reasons` and `ratify` phases (thesis adoption moves to the brief and Theses, unchanged
mechanics), `onb_demo_chosen` and the demo path, and the attribution question, which moves
to the second session as a one-line survey. `lib/grant-connect-trial.ts` stays: manual and
Plaid both grant the trial exactly as today.

## 5. Copy rules

No em dashes. No exclamation marks. No advice language: Helm never says buy, sell, trim or
should. The reveal states what the book is, not what to do about it. Every figure computed
from live data; nothing labelled demo appears in production.

## 6. After the terminal (touches Codex-owned files; coordinate)

- **Portfolio empty state** (`app/dashboard/portfolio/page.tsx`): when the book is empty,
  render the Screen 1 ask inline where the holdings table will be, headed "Start with what you
  own." This is what "Do this later" lands on and what a user who skipped sees on day two.
- **Sidebar** (`app/dashboard/dashboard-shell.tsx`): items dim with a small label until they
  have something to say. Brief: "tomorrow" until the first brief exists for this user. Theses,
  Earnings, Agent: "after your brief". Taxes: "needs cost basis" until a Plaid account exists.
  Dimmed items still navigate; they are not disabled.
- **Actions inbox**: while the user has one account, a standing item "Add your second
  account" linking to Accounts. Removed when a second account exists.
- **Brief promise**: a single banner on Portfolio until the first brief lands: "Your brief
  on these {n} positions lands at 9:15 ET tomorrow."

## 7. Events

New, all with `flow: 'v3'`: `onb3_shown`, `onb3_ask_choice {plaid|manual}`,
`onb3_plaid_exit {reason}`, `onb3_account_added {via, accounts}`, `onb3_loop_continue
{accounts, positions}`, `onb3_reveal_viewed {top_ticker_covered: bool}`,
`onb3_terminal_opened`, `onb3_deferred {screen}`. Keep `plaid_link_started`,
`plaid_link_exit`, `plaid_link_completed`. Retire `onb_*` v2 events when the flag flips.

## 8. Success criteria

Activation = a book (≥1 account with ≥1 holding) inside the first session. Baseline from v2:
link completed 13 of 125 shown (10%), plus one manual start. Targets after 40 people through
v3: book rate ≥30% of shown; two-day return ≥35% overall (baseline 21%); seven-day return
measured and reported, baseline ≤20% on every path. Read with the same HogQL as the 9/8
analysis so the numbers are comparable.

## 9. Rollout

Behind `NEXT_PUBLIC_ONBOARDING_V3` in Vercel, the same gate pattern as v2 in
`app/dashboard/layout.tsx`. Ship dark, flip for 100% of new signups, read at 40 people.
No cohort split needed; v2's numbers are the control.

## 10. Risks

- **V1 bounce.** Ask-first is how v1 lost 83–86%. The differences: manual at equal weight,
  three trust rows, Link exits handled on-screen, and the reveal is about the user. If the
  book rate after 40 people is under v2's 10%, revert the flag; the spec is wrong.
- **Manual books are thin.** Taxes and multi-account overlap stay dark until Plaid. The loop
  screen and the inbox item exist to close that, not the ask.
- **Coverage.** The receipt card covers 13 names. The honest fallback is the design, not a bug.

## 11. Testing

Unit: exposure sentence for one account, two accounts, funds only, no funds. Manual retry
does not duplicate a lot. Link exit reasons route correctly. Copy lint for em dashes and the
advice words. E2E in `/testing`: the three screens on a no-brokerage account with real reads
and zero writes, all six viewports the v2 QA script already covers
(`scripts/qa-full-onboarding.mjs`). Full suite before and after, totals reported.
