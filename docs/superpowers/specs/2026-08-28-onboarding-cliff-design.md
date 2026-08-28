# Onboarding cliff: the off-house scan card, and the four screens after it

Written 2026-08-28. Approved by Evan the same morning ("Go ahead").

## The numbers this answers

Onboarding v2, 30 days to 2026-08-27 (PostHog): 76 shown, 74 scanned, 74 saw the card, 15 opened Plaid, 4 linked.
Split the card by whether the typed ticker had a house thesis:

| card | users | opened Plaid | linked |
|---|---|---|---|
| house thesis + verbatim citation | 43 | 13 (30%) | 3 |
| "Helm isn't tracking a thesis on X yet" + link out to /analyze | 31 | 2 (6.5%) | 1 |

Same flow, same ask. Something real about the ticker they typed moves the brokerage ask 4.7x.
42% of new users get the empty version. Downstream: 19 of 74 took "Explore a demo first" and 1
explored it; 41 of 74 reach the dashboard unlinked and see "See Helm in action", with the ticker
they scanned and the reasons 13 of them adopted nowhere on screen.

What people typed when it was not a house name (90 days, ~80 scans): company names and typos
(APPL, HEICO, MICRON, MERCADOLIB, RELIANCE), things that do not file with the SEC (XAUUSD, EURUSD,
ES, MNQ, CL, CORN, ETH, XRP, BTC), funds (VOO, VGT, XLK, GLD, FXAIX, LSVEX), foreign listings
(ABAXX, SWIRE), and a minority of real uncovered US equities (TTWO, ADBE, CRM, JPM, HIMS, SE, ZETA).

## Decision

Draft on demand, in the scan, using what exists. `/api/thesis/seed` already drafts 2-4 cited
pillars for any SEC filer (gpt-4o-mini grounded in the EDGAR profile and the cached /analyze read,
never billing a new analysis), for free users too, rate-limited, as an untracked thesis with
`origin: ai_draft` pillars; the ratify phase already confirms pillars and tracks the thesis. The
off-house card reuses that: draft, show as "Helm's read, drafted just now", let the person pick
which reasons are theirs, confirm and track (free tier: one). Never a verdict: the card says no
filing has tested these yet and the first check is tomorrow.

Rejected: expanding the house list by hand (flat tail, covers none of the non-filers); an email
watch (the watch digest only carries house-universe catches, so an off-house watch emails nothing).

## The scan, classified

`GET /api/scan/ticker` stays public and cheap. It classifies the symbol:

- `house`: unchanged.
- `filer`: the symbol is in EDGAR's company list (companies and listed funds). Returns the name.
  The signed-in onboarding client then calls `/api/thesis/seed` during the scan animation and
  renders the drafted pillars. Signed-out previews get the honest degrade as before.
- `suggest`: not a ticker, but the text matches company names (typos, names typed as tickers).
  Returns up to three `{ticker, title}` suggestions; the card asks "Did you mean" and rescans.
- `unreadable`: nothing to read (forex, futures, commodities, crypto, foreign listings). The card
  says so in one sentence and offers the house picks; the person stays in the flow.

Name matching is a pure function over EDGAR's `company_tickers.json` (already fetched for CIK
lookup; now also keeps titles): exact ticker, then ticker prefix, then title prefix, then title
word prefix; two-character queries only match tickers; collapse duplicate titles.

## The card for a drafted name

Header: `HELM'S READ · TTWO`. Title: the company. Provenance line: "Drafted just now from its
filings and Helm's read of the business. No filing has tested these yet; Helm checks every trading
day from tomorrow and shows the receipt when one does." Then the pillars with breaks-if, then the
same recognition step ("Which of these are your reasons?") and the same ask. Confirm = PATCH each
picked pillar `confirmed: true`, dismiss unpicked drafts, PATCH the thesis `tracked: true` (403 =
free cap reached, said plainly). "Something else" writes a user pillar as the custom reason.

## The four screens after it

1. `howItWorks` becomes one screen, no pricing table: "Helm re-checks TTWO every trading day. The
   first receipt reaches [email] tomorrow morning." Continue. Pricing leaves onboarding.
2. Connect: "Connect a brokerage, 401(k) or stock plan"; "Not on Plaid? Add holdings manually"
   visible beside it. The demo choice leaves this screen (19 chose it, 1 explored).
3. Dashboard empty state for an unlinked user with a thesis: the ticker, the reasons they kept,
   "first check tomorrow", then the connect button; the demo stays as the secondary action.
4. Events: `onb_scan_completed` gains `kind`; `onb_draft_shown`; `onb_reasons_adopted` gains
   `drafted`.

## How we will know

Card to Plaid attempt by `kind` (today 30% house / 6.5% off-house), scan to adopt, day-2 return
(35%), `plaid_link_exit` by status. Two weeks of data after promote.
