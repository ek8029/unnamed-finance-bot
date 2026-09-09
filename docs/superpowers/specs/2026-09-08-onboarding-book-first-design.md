# Onboarding v3: book first, one reveal, then the terminal

Date: 2026-09-08, revised the same day after five reviews (implementability, Plaid, conversion,
security, accessibility). Status: design, approved direction (variant C of `/testing/onboarding-lab`).
Owners: Astra builds the surfaces. Codex owns `app/dashboard/dashboard-shell.tsx` (the v2 flag gate
is at line 55 and the sidebar in section 6 lives there) and `app/dashboard/portfolio/page.tsx`
(the empty state in section 6). Coordinate before editing either.

## 1. Why

Measured 9/8 (PostHog, 90-day signup cohort n=96, internal excluded; DB probe n=247):

- A book (Plaid or manual) returns 50% at two days; no book 15%; demo only 9% (0% at seven days).
- Day-one breadth does not hurt: 5+ dashboard routes 29% return, 1–2 routes 18%. 60 of 71
  no-book users saw two routes or fewer. They left at the door, not from overwhelm.
- The v2 flow loses people at every step between the scan card and the book: card 122 →
  reasons shown 53 → thesis adopted 30 → link started 26 → link completed 13. Thesis-adopt
  on its own retains 24% / 8%.
- Manual entry: one start in 60 days, zero accounts since the 9/4 fix, yet manual books retained
  like Plaid books while the form was broken. The credential-free path is hidden.
- Return destination days 2–14: the brief (11 of ~20 returners), then Portfolio, Actions.
- Plaid: 42 starts → 11 completed. 16 closed the picker, 10 `institution_not_found`.
- v1 was ask-first with Plaid only and bounced 83–86% at the ask. That is the ceiling this
  design has to beat, and the reason manual entry is co-equal rather than a footnote.

So: the ask comes first, manual is co-equal, every screen after the ask is about the user's
own book, thesis adoption waits for the brief, demo is removed.

## 2. Scope

In: the flow below, its events, the Portfolio empty state, sidebar dimming, the brief promise,
the `PlaidLinkButton` prop change in 3.1, the first-look question in 3.4 and its column. Out: pricing, paywall, push, iOS, the brief's content.

## 3. Flow

```
signup ─► [1 Ask] ─► [2 Loop] ─► [3 Reveal] ─► /dashboard/portfolio (real)
              │          │            │
              └──────────┴────────────┴── "Do this later" ─► Portfolio empty state (6)
```

Three screens, full-bleed overlay over the dashboard like v2, `helm-terminal` skin. Every screen
has a "Do this later" text link in the same place (bottom left). It fires `onb3_deferred {screen}`
and lands on the Portfolio empty state, never a blank terminal. Progress is a
`role="progressbar"` with `aria-valuenow/min/max` and visually hidden "Step n of 3".

### 3.1 Screen 1: Ask. "Start with what you own."

Two panels, same card, same height, same button style. **Below 860px the manual panel stacks
first**; it is the credential-free path and must not fall below the fold.

**Add the positions you hold** (manual). Copy: "Three to five tickers is enough. No credentials,
no account numbers. Connect a brokerage later to import the rest." Uses `ManualPortfolioForm`
compact and `POST /api/portfolio/manual` (authenticated, validates ticker and shares, max 50 rows,
idempotent per client `requestId` scoped to the user, so a retry never duplicates a lot). As rows
are added, a one-line preview renders under the form using the exposure sentence from Screen 3
on the rows so far ("NVDA is 61% of these three positions"). This is the answer to the 27
"explore first" people: they explore with their own tickers, not a demo. Inputs 16px, targets
44px.

**Connect a brokerage.** Copy: "Read-only. Helm can see positions and balances and can never
trade, move money or see your login." Six shortcut chips (Fidelity, Schwab, Robinhood, Vanguard,
E*TRADE, Interactive Brokers) and "Search all brokerages". Every control opens Plaid Link through
`PlaidLinkButton`. Trust rows, written in full:
1. "Read-only. Helm cannot trade or move money."
2. "Disconnect any time from Accounts. Helm removes the connection and everything it imported."
   (Implemented: `app/api/plaid/items/[itemId]/route.ts` calls `itemRemove` and deletes the
   holdings, transactions and accounts.)
3. "Your login goes to Plaid, never to Helm."

Pre-pointing a chip at an institution: `create-link-token/route.ts` passes no `institution_id`
today, so this needs new token code either way; whether Plaid Link accepts it is an open item to
check in Plaid's current docs before build. Until confirmed, chips open Link's search.

**Link exits.** `PlaidLinkButton.onExit` is currently `() => void` and the exit reason and search
term are captured only for analytics (`plaid-link-button.tsx:171-184`). Add a typed
`onExitDetail({ code, institutionName, searchQuery })` prop; keep the existing props. Route:

| exit | screen behaviour |
|---|---|
| `institution_not_found` | focus the manual panel; notice: "{searchQuery} is not available through Plaid yet. Add those positions by hand. Everything works on positions entered by hand." |
| `INSTITUTION_DOWN`, `INSTITUTION_NO_LONGER_SUPPORTED`, `INSTITUTION_REGISTRATION_REQUIRED` | same as above, with the message from `link-exit.ts` |
| `INVALID_CREDENTIALS`, `ITEM_LOCKED` | stay on the screen; show the `link-exit.ts` message under the chips; chip remains available |
| picker closed, no error | stay; nothing changes |
| `duplicate_institution` (from the exchange route) | go to Screen 2 with "{institution} is already connected" |
| success | Screen 2 |

After every exit, focus returns to the chip or button that opened Link.

### 3.2 Screen 2: Loop. "Is that all of it?"

Lists accounts on record: institution, type, position count, "imported" or "entered by hand".
Right after a Link success the row reads "Syncing {institution}" with the v2 `synced` phase's
stage indicator; `lib/plaid/background-sync.ts` takes one to six minutes with a six-minute
timeout, and the user can add another account or continue while it runs. Same shortcut chips
minus the linked ones, plus the compact manual form. Copy for one account: "Most people who pay
for Helm hold accounts at two or more brokerages. Add the others and the exposure view shows the
overlap between them." For two or more: "{n} accounts, {positions} positions, {value}. Add
another, or continue." Primary: "Show me what Helm sees". Secondary: "You can add accounts any
time from Accounts."

### 3.3 Screen 3: Reveal. "Here is your book, read."

Two cards side by side, stacked under 860px. States, in order:

- **Loading**: "Reading your book" skeleton while exposure and the receipt fetch; if a Plaid sync
  is still running, compute on what has arrived and say "{institution} is still syncing; this
  updates when it lands."
- **Fetch error** (network or 5xx): "Helm could not read the filings just now." with Retry and
  "Open the terminal". This is distinct from the coverage fallback below.
- **Ready.**

**What you actually own.** Top five names by total exposure, each bar split into held directly
and inside funds. Segments differ by pattern as well as colour, and every row carries visually
hidden text "{T}: {d}% direct, {i}% inside funds". Then one sentence for the top name: "{T} is
{p}% of your book: {d}% held directly, {i}% inside {funds}, across {n} accounts. That figure
comes from every account and the funds inside them." Data: the existing look-through behind the
True Exposure toggle on the portfolio page: `computePortfolioLookthrough` in `lib/etf-holdings.ts:632`. Do not write a second one.

**The reason you hold {T}, checked.** The v2 card's data path (`getTickerThesisData`) on the
largest position: verdict chip, pillar, verbatim quote, source and date, link to the filing.
Outside the covered names, the v2 fallback verbatim: "No filing has moved {T} in the last 90
days." Never a fabricated verdict.

Primary: "Open the terminal" → `/dashboard/portfolio`. Under it: "The brief on these positions
lands at 9:15 ET tomorrow."

### 3.4 First look: one question in the dead time

Added 9/8 after review. A single skippable question that orders what the user sees, asked where
there is already a wait. It never gates anything and never adds a screen.

**Where.** After a Plaid connect, the Screen 3 loading state ("Reading your book") lasts one to
six minutes of sync. The question renders inside that state. On the manual path there is no wait,
so it renders on Screen 2 under the account list. Never before Screen 1.

**Copy.** Heading: "What do you want to see first?" Multi-select, one line each, no verbs of
action:
1. "How much of everything I actually own" (`exposure`)
2. "Whether the reasons I hold these still hold" (`receipts`)
3. "What changed in these positions today" (`changes`)
4. "Overlap between my accounts" (`overlap`), shown only at two or more accounts.
"Skip" is a text link. Under ten seconds. Every option is deliverable on any book: exposure
always; receipts with the section 3.3 fallback; changes from the same data the brief reads;
overlap from the look-through across accounts. Tax-loss harvesting is not an option (needs cost
basis, Plaid only, and Pro), and earnings is not an option (`market_events` has no upcoming
earnings rows today). Nothing offered here may land on a paywall or an empty panel.

**What the answer drives.** If it only reordered one screen it would be a survey.
- Screen 3: the chosen card renders first; "changes" adds a third card, "what moved today in
  these positions", from the delta endpoint (today's largest mover in the book, one item); "overlap" swaps the exposure sentence for the
  cross-account one.
- Section 6 sidebar: the matching item is the first to light.
- The first brief leads with the chosen section (see section 6).
- Actions inbox: the standing "Add your second account" item moves below the chosen item.

**Storage.** `user_preferences.first_look TEXT[] NULL` (migration 077; the table has
`UNIQUE(user_id)` and a row is created at signup and in the OAuth callback, so this is an
`update`, never an insert). Written through `PATCH /api/user/preferences`. Values are the four
codes above only, validated server side. Not PostHog: it is opt-in and undercounts, and this has
to exist for every user. The event in section 7 carries only the count, not the choices.

## 4. What is removed from v2

The scan-first card as the entry (it becomes the receipt on the user's largest holding), the
`reasons` and `ratify` phases (thesis adoption moves to the brief and Theses, mechanics
unchanged), the demo path (`DEMO_EMAIL` gate, `onboarding-flow-v2.tsx:34,297`), and the
attribution question, which moves to the second session as a one-line survey. No trial grant is
needed: the automatic connect trial was retired (comment in `exchange-public-token/route.ts:218`),
the first thesis is on the free tier, and the only trial is the card-required one on `/pricing`.

## 5. Copy rules

No em dashes. No exclamation marks. No advice language: Helm never says buy, sell, trim or
should. The reveal states what the book is, not what to do about it, and does not compare Helm
to anything. Every figure computed from live data; nothing labelled demo appears in production.

## 6. After the terminal (Codex-owned files; coordinate)

- **Portfolio empty state** (`portfolio/page.tsx`): when the book is empty, render the Screen 1
  ask inline where the holdings table will be, headed "Start with what you own." This is where
  "Do this later" lands and what a user who skipped sees on day two.
- **Sidebar** (`dashboard-shell.tsx`): items dim with a small label until they have something to
  say. Brief: "tomorrow" until the first brief exists. Theses, Earnings, Agent: "after your
  brief". Taxes: "needs cost basis" until a Plaid account exists. Dimmed items still navigate:
  no `aria-disabled`, no `disabled`, label text at 4.5:1 or better, the small label read as part
  of the link name.
- **Actions inbox**: while the user has one account, a standing item "Add your second account"
  linking to Accounts; removed at two.
- **Brief promise**: one banner on Portfolio until the first brief lands.
- **Brief lead** (`lib/generate-digest.ts`, `lib/digest-cron.ts`): the first brief for a user
  with `first_look` set leads with the chosen section; later briefs keep the normal order. Confirm
  the section order is a data path and not prompt text before build.

## 7. Events

New, all with `flow: 'v3'` and no free text, tickers, institution names or amounts:
`onb3_shown`, `onb3_ask_choice {plaid|manual}`, `onb3_plaid_exit {code}`,
`onb3_account_added {via, accounts}`, `onb3_loop_continue {accounts, positions}`,
`onb3_reveal_viewed {top_ticker_covered: bool, synced: bool}`, `onb3_terminal_opened`,
`onb3_deferred {screen}`, `onb3_first_look {count, skipped}`. Keep `plaid_link_*`. PostHog is opt-in by default
(`posthog-provider.tsx:90`), so these fire only for consented users; they explain behaviour,
they do not count it.

## 8. Success criteria

Counting comes from the database, not PostHog: a new signup is **activated** when
`linked_accounts` or `plaid_items` holds a row within 24 hours of `auth.users.created_at`, and
**returned** when `last_sign_in_at` is two or more days after signup (the 9/8 probe,
`scripts/probe-book-retention-2026-09-08.ts`). Population: every real signup that reached the
dashboard, the same denominator for v2 and v3. Baselines: v2 activation 10% (13 of 125) plus one
manual start; v1's ask-first ceiling 14–17%; two-day return 21% overall.

Targets after 40 new signups: **activation ≥25%**. The two-day return target is derived from it,
not chosen: at 25% activation and the measured 50% / 15% returns, blended two-day return is about
24%, so the target is **≥25%** and anything at 35% would mean activation near 57%. Seven-day
return is measured and reported; baseline ≤20% on every path today.

## 9. Rollout

Behind `NEXT_PUBLIC_ONBOARDING_V3`, gated where v2's flag is (`dashboard-shell.tsx:55`). Ship
dark, flip for 100% of new signups, read at 40 people. v2's numbers are the control. If
activation after 40 people is under v2's 10%, revert the flag; the spec is wrong.

## 10. Risks

- **V1 bounce.** The differences from v1: manual at equal weight and first on mobile, the live
  preview while typing, three written trust rows including revocation, every Link exit handled
  on screen. Section 9 is the kill switch.
- **Manual books are thin.** Taxes and overlap stay dark until Plaid. The loop screen and the
  inbox item exist to close that, not the ask.
- **Coverage.** The receipt covers the 40 names in `lib/content/universe.ts`. The honest fallback is the design, not a bug.
- **Sync timing.** A reveal on a half-synced book must say so (3.3), or it reads as wrong.

## 11. Testing

Unit: exposure sentence for one account, two accounts, funds only, no funds; the live preview
on one, two and three rows; manual retry does not duplicate a lot; every row of the exit table
routes correctly; `first_look` validation rejects unknown codes and orders the reveal cards for each
single choice, the empty set, and skip; copy lint for em dashes, exclamation marks and the advice words. Accessibility:
focus return after each exit, progressbar exposed, 44px targets and 16px inputs, bar segments
distinguishable without colour, dimmed sidebar items announced as links. E2E in `/testing`: the
three screens on a no-brokerage account with real reads and zero writes, six viewports via
`scripts/qa-full-onboarding.mjs`. Full suite before and after, totals reported.
