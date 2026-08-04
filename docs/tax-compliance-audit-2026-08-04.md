# Tax code compliance audit - 2026-08-04

5 statutory specialists + adversarial review. 36 candidates, 24 confirmed.
Sources fetched from irs.gov / law.cornell.edu per finding.

## Status — 2026-08-04 (commits 40326cc, e714aab)

**Fixed.** All five P0s and every P1 except the two noted below.
- Wash-sale detection reads `investment_transactions` instead of the unwritten
  `capital_gains`; covers same-ticker and related buys, DRIP reinvestments, and
  retirement-account purchases (Rev. Rul. 2008-5 language).
- Holding a related security is advisory, not a flag, and no longer drops the
  lot from the savings pool. A prior sell no longer flags.
- Every clearance claim removed: "Eligible" → "No conflict", no "wash-sale-safe"
  or "IRS-ready" anywhere, public TLH calculator and drip email rewritten.
- Both halves of the 61-day window stated on every harvest surface.
- Engine DISCLAIMER rendered on /dashboard/taxes, extended to NIIT/state/MFS/lot ID.
- `estimateCappedTlhSavings` reports the MARGINAL benefit of the harvest.
- Retirement losses excluded from research/note/ledger harvest totals.
- One `estimateTaxOnRealizedGains` with §1222(11) netting, shared by the client
  Tax Center and the server engine (pure math extracted to `lib/tax-math.ts`).
- `classifyHoldingPeriod` on the IRS anniversary rule; unknown-character losses
  valued at the LT rate, not the nonexistent 23.5% midpoint.
- Form 8949: lot-constrained column (b), box C/F designation, column (f) added,
  column (g) prints NOT COMPUTED, (h) derived from (d)−(e), unclassified rows to
  Part I, selectable tax year, caveats inside the CSV.
- §1211(b) harvest ladder shipped on /dashboard/taxes.

**Still open** (all disclosed on-screen, none silently wrong):
- `lib/financial-config.ts:25` — the $3,000 cap is deploy-wide; MFS ($1,500) is
  collected in settings but not applied. Copy now says "assumed".
- `lib/research/account.ts:241`, `lib/insights-engine.ts:242`,
  `lib/thesis-actions.ts:370` — still pass `unknownLoss` rather than real loss
  character, so these surfaces can quote a lower figure than the Tax Center.
- `lib/tax-analysis.ts:515` — IRC §1223(3) wash-sale holding-period tacking is
  disclosed but not computed (needs specific-lot identification).
- `app/api/tax/form-8949/route.ts:94` — `capital_gains` has no account link, so
  IRA dispositions cannot be filtered out. Stated on the artifact.
- Remaining display specs: holding-period clock, wash-sale window calendar,
  carryforward bank, netting order (`docs/superpowers/specs/2026-08-04-tax-mechanics-displays.md`).

## P0 - lib/tax-analysis.ts:345
**Statute:** IRC 1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** The primary same-ticker wash-sale check queries `capital_gains`, a table no production code path ever writes; real Plaid buys land in `investment_transactions`, which is never queried for the harvested ticker itself, so acquisitions inside the 30-day-before window are structurally undetectable and every position is labeled wash-safe.

> In the case of any loss claimed to have been sustained from any sale or other disposition of shares of stock or securities where it appears that, within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law), or has entered into a contract or option so to acquire, substantially identical stock or securities, then no deduction shall be allowed under section 165

**Current:** checkWashSaleRisk() computes windowStart = today - 30d and queries `capital_gains` filtered `.in('ticker', tickers)`. Grep across the repo shows the ONLY writers of `capital_gains` are scripts/seed-losses.ts:223 and scripts/seed-test-user.ts:670 (demo seeding); there is no INSERT, UPSERT, or DB trigger populating it from Plaid. lib/plaid-sync.ts:651 upserts real brokerage buys/sells into `investment_transactions` (migration 039, `transaction_type` = Plaid subtype 'buy'). The one `investment_transactions` query in this function (line 422) filters `.in('ticker', relatedTickerList)` — a list built by getRelatedTickers(), which by construction EXCLUDES the ticker itself (`if (t !== upper)`) — and is gated behind `if (relatedTickers.length === 0) continue;`, so it never runs for tickers outside SHARE_CLASSES / SINGLE_STOCK_MAP / INDEX_GROUPS. The `transactions` query at line 368 assigns `rece

**Correct:** Query `investment_transactions` for the harvested ticker itself (and its related tickers) with transaction_type in ('buy','transfer in','reinvestment') over transaction_date >= today-30d, across ALL of the user's linked accounts including retirement ones. Either backfill `capital_gains` from `investment_transactions` or drop `capital_gains` from the detection path entirely. Until same-ticker buy detection actually runs against populated data, the UI must not assert that no substantially identical securities were detected and must not use the phrase 'wash-sale-safe'; it should say only that Helm found no acquisition in the data it has, and name the gap.

**Harm:** A user who bought more of the same ticker two weeks ago — dollar-cost averaging, an RSU vest, a rebalance — is affirmatively told the lot is 'Eligible' with 'no substantially identical securities detected,' sells to harvest, and the entire loss is disallowed under 1091(a). Helm's headline 'offsets an estimated $X in taxes this year' is then wrong by the full amount of that lot.

---

## P0 - lib/research/account.ts:150
**Statute:** IRC §408(e)(1) (IRA is exempt from taxation; gain and loss inside the account are not currently recognized by the owner) with IRC §408(d)(1) (only distributions enter gross income); IRC §1211(b) limits apply only to recognized capital losses  
**Source:** https://www.law.cornell.edu/uscode/text/26/408

**Issue:** The chat/weekly-note tax block and the value ledger label every unrealized loss in the book as "harvestable" and attach an estimated tax saving, without excluding losses held inside IRAs, 401(k)s, HSAs and 529s — losses that produce no current deduction at all.

> Any individual retirement account is exempt from taxation under this subtitle unless such account has ceased to be an individual retirement account... any amount paid or distributed out of an individual retirement plan shall be included in gross income

**Current:** getPortfolioBrief (lines 38-45) selects every holdings row with no account_type/account_subtype filter. getTaxContext then filters only on `(h.unrealizedGainLoss ?? 0) < 0` (line 150) and emits `=== HARVESTABLE LOSSES ===` / `Total harvestable loss: $X across N positions` / `Estimated tax savings if realized this year: $Y`. getValueLedger repeats the same unfiltered reduce (lines 230-232) and books the result as a ledger line labeled `Tax-loss harvesting surfaced`, which becomes ctx.ledger.surfacedTotal and is rendered to the model as `=== VALUE SURFACED BY HELM ===`. The project's own engine does the opposite: lib/tax-analysis.ts exports isRetirementAccount / isHarvestableLoss and splits retirementPositions out with `savings: 0`, and the Tax Center renders them under "Not eligible for tax-loss harvesting." The research path never calls either helper — there is no reference to `retiremen

**Correct:** Route these two call sites through the existing exported helpers rather than a raw sign filter. Add account_subtype/account_name to the getPortfolioBrief select, carry an `isRetirement` flag onto BriefHolding, and filter with `isHarvestableLoss` before summing in both getTaxContext (line 150) and getValueLedger (line 230). Then state the exclusion in the copy the user actually sees: replace the getTaxContext header block with "=== HARVESTABLE LOSSES (unrealized losses in TAXABLE accounts only) ===" and the closing note at line 166 with "Taxable accounts only — losses inside IRAs, 401(k)s, HSAs and 529s are excluded because those accounts are tax-exempt under IRC §408(e)(1) and produce no current deduction. Estimate only, before wash-sale checks. Not tax advice." Change the ledger label at line 235 to "Tax-loss harvesting surfaced (taxable accounts, estimate)."

**Harm:** A user is told Helm surfaced $X of tax savings on losses that are legally worthless for tax purposes. Acting on it means selling a retirement position for a deduction that does not exist, and the number is also quoted back in the grounded chat and the weekly note as if it were a real, deterministic dollar.

---

## P0 - app/dashboard/taxes/page.tsx:1360
**Statute:** IRC §1091(a) (61-day symmetric window: 30 days before through 30 days after); Rev. Rul. 2008-5, 2008-3 I.R.B. 271 (purchase by the taxpayer's IRA/Roth IRA disallows the loss AND no basis restoration)  
**Source:** https://www.irs.gov/irb/2008-03_IRB

**Issue:** The Tax Center asserts an affirmative §1091 clearance ("Eligible", "no wash-sale conflicts", "wash-sale-safe") that the underlying scan structurally cannot establish — it never sees the forward 30 days, IRA purchases, a spouse's purchases, unlinked brokerages, or DRIP reinvestments.

> The loss on the Sale of stock is disallowed under § 1091. A's basis in the individual retirement account or Roth IRA is not increased by virtue of § 1091(d).

**Current:** Line 1360 renders, for every position the scan did not flag: "No substantially identical securities detected in your portfolio or recent transactions, per IRC §1091." The row badge reads "Eligible" (line 1440), the panel subhead reads "· no wash-sale conflicts" (line 607), the empty states promise Helm "flags wash-sale-safe harvesting opportunities" (lines 229, 250-251), and the paywall blurb sells "wash-sale-safe harvesting" (line 265). The engine behind that claim is checkWashSaleRisk in lib/tax-analysis.ts, whose window is `Date.now() - WASH_SALE_WINDOW_DAYS` — a 30-day BACKWARD lookback only (line 339), against `capital_gains` rows for the linked user only. The file's own header comment concedes the gaps: "⚠️ Cross-account wash sale aggregation — NOT implemented" and "⚠️ Dividend reinvestment wash sales — NOT implemented" (lines 11, 14), and an inline comment states "What we CANNOT c

**Correct:** Never state a clearance. Rename the badge from "Eligible" to "No conflict found" and replace line 1360 with: "Helm found no purchase of this security, or of a security we treat as related, in your linked accounts in the last 30 days. IRC §1091 also disallows the loss if a substantially identical security is acquired in the 30 days AFTER the sale, or is acquired by your IRA or Roth IRA (Rev. Rul. 2008-5 — that loss is permanently disallowed and is not added to basis), by your spouse, in an account you have not linked, or through automatic dividend reinvestment. Helm cannot see those. This is not a wash-sale clearance." Change line 607 to "· none flagged by Helm's 30-day lookback", lines 229 and 250-251 to "flags harvesting opportunities and screens them against a 30-day wash-sale lookback", and line 265 to "Tax-lot tracking, wash-sale screening, and a Form 8949 worksheet across your conne

**Harm:** A user reads "Eligible" as permission, harvests, and then reinvests inside their IRA within 30 days. Under Rev. Rul. 2008-5 that loss is gone permanently — unlike an ordinary wash sale, it is not even recovered through basis. The user believes Helm checked and it did not.

---

## P0 - app/tools/tlh-calculator/page.tsx:108
**Statute:** IRC §1091(a) (the disallowance is tested across everything the taxpayer acquires, not per account); Rev. Rul. 2008-5 (IRA purchases count); IRS Pub. 550, Wash Sales (a spouse's or a controlled corporation's purchase counts)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** A public, SEO-indexed page states as fact that Helm Pro detects wash-sale violations across the user's linked accounts automatically; the engine's own header comment says cross-account wash-sale aggregation is not implemented.

> within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law), or has entered into a contract or option so to acquire, substantially identical stock or securities, then no deduction shall be allowed

**Current:** Line 108 of the public page reads: "Helm Pro detects wash-sale violations across your linked accounts automatically." Line 116 adds "continuously scans for tax-loss harvesting opportunities with wash-sale rule awareness." lib/emails/templates.ts:237 sends the same claim to unconverted signups as "Tax center — Wash-sale-aware tax-loss harvesting." The implementation in lib/tax-analysis.ts documents the opposite at line 11: "⚠️ Cross-account wash sale aggregation — NOT implemented (requires multi-account)", and checkWashSaleRisk queries capital_gains/investment_transactions with no cross-account reconciliation and no forward window. Because §1091 is tested at the taxpayer level, a per-account backward scan cannot detect the violations the page promises.

**Correct:** Replace line 108's final sentence with: "Helm Pro screens the accounts you link for purchases of the same or a related security in the 30 days before a candidate sale, and flags what it finds. It cannot see accounts you have not linked, purchases made by your IRA or your spouse, or purchases you make after the sale — all of which can still trigger §1091, so confirm with your tax professional." Apply the same replacement to line 116 and to lib/emails/templates.ts:237 ("Tax center — harvestable losses with 30-day wash-sale screening"). Until cross-account aggregation actually ships, no surface should use the words "detects violations", "wash-sale-safe", or "automatically".

**Harm:** A prospect buys the Pro tier on the belief that the product will catch wash sales for them across their brokerages. It will not, and the loss they claim in reliance on that belief is disallowed on audit.

---

## P0 - app/api/tax/form-8949/route.ts:138
**Statute:** Form 8949 Instructions, Column (b)—Date Acquired; and the multiple-purchase 'VARIOUS' rule  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** Column (b) Date acquired is fabricated from the earliest-ever purchase of the ticker rather than the lot actually disposed of, and the 'Various' convention is applied backwards.

> Enter in this column the date you acquired the property. Enter the trade date for stocks and bonds you purchased on an exchange or over-the-counter market. ... If you sold a block of stock or digital assets (or similar property) that you acquired through several different purchases, you may report the sale on one row and enter 'VARIOUS' in column (b).

**Current:** Lines 109-129 query every capital_gains 'buy' row for the ticker with no date bound and no lot matching, order ascending, and take the first. Line 138-140 stamps that single earliest date as column (b) for EVERY sell of that ticker in the year. The literal string 'Various' (wrong case; IRS prints VARIOUS) is emitted only in the opposite case — when no buy row exists at all. Because the buy lookup is not restricted to purchases preceding the sale, a user who sold out and re-entered a name gets a date acquired LATER than the date sold.

**Correct:** Derive column (b) from the specific lot(s) disposed of. Enter 'VARIOUS' only when one reported sale spans several acquisition dates, which is exactly when the code currently prints a single concrete date. When the lot is genuinely unknown, leave the field blank/flagged and send the user to the 1099-B rather than inventing a trade date. Constrain any inferred acquisition date to be on or before the disposition date.

**Harm:** A user who bought AAPL in 2019 and again three months ago, then sold the recent lot, is shown a 2019 acquisition date — the row reads as long-term and, combined with the Part I/Part II split, invites reporting a short-term gain at preferential long-term rates. In the re-entry case the export contains an impossible row (acquired after sold) that a preparer or e-file schema will reject.

---

## P1 - lib/tax-analysis.ts:620
**Statute:** IRC §1211(b); IRS Topic No. 409; Pub. 550, "Limit on deduction"  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** Already-realized YTD net capital losses are folded into the harvest loss pools, so the §1211(b) $3,000 ordinary-income deduction the user already has is re-reported as savings caused by the proposed harvest.

> In the case of a taxpayer other than a corporation, losses from sales or exchanges of capital assets shall be allowed only to the extent of the gains from such sales or exchanges, plus (if such losses exceed such gains) the lower of— (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains. [IRC §1211(b)] / "the lesser of $3,000 ($1,500 if married filing separately) or your total net loss" [Topic No. 409]

**Current:** Lines 620-622 seed the loss pools with `Math.max(0, -params.stGainYtd)` and `Math.max(0, -params.ltGainYtd)` — i.e. losses the user ALREADY realized this year. Line 654 then computes `deductibleThisYear = Math.min(netLoss, 3000)` over that combined pool and line 655 credits the whole thing to `cappedSavings`. Because §1211(b) is a per-return, per-year limit, the deduction is non-additive: once other losses fill the $3,000, an extra harvested loss produces ZERO incremental current-year deduction. Worked example: user already realized $10,000 net short-term loss YTD and holds $500 of wash-safe unrealized loss. Pools = 10,000 ST + 500 LT, no gains, netLoss = 10,500, deductible = 3,000, cappedSavings = $960. Baseline with NO harvest is also $960. The true incremental benefit of harvesting is $0, but $960 is presented as the harvest's benefit. Milder case: $2,000 already realized + $500 harve

**Correct:** Report the MARGINAL §1211(b)/§1212(b) benefit of the proposed harvest: compute the result twice — once with the harvest candidates and once with only the already-realized YTD position — and surface the difference. Concretely, return `cappedSavings` for the harvest scenario minus `cappedSavings` for the baseline (harvest pools = 0, same stGainYtd/ltGainYtd). Already-realized losses must still enter the netting (they legitimately consume the cap and change the marginal answer) but must not be credited as savings the harvest produces. Alternatively, keep the total but relabel every surface to "your total capital-loss position offsets an estimated $X" and add a separate "$Y of that comes from losses you already realized" line — the current sentences all condition the dollar on the user taking the harvest action.

**Harm:** A user who has already been harvesting this year — precisely the Tax Center's core audience — is told a fresh sale saves up to $960 (at the 32% default rate) of tax when it saves nothing this year and merely adds to the §1212(b) carryforward. They may realize a loss, trigger a wash-sale window, and lock in a basis reduction for a benefit they already had.

---

## P1 - lib/research/account.ts:161
**Statute:** IRC §1211(b); IRS Topic No. 409; Pub. 550, "Limit on deduction"  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** getTaxContext hardcodes `stGainYtd: 0, ltGainYtd: 0` into the capped-savings estimator even though it computed the user's real YTD realized short-term and long-term nets 30 lines earlier, so the estimate ignores the unlimited gain offset §1211(b) grants before the $3,000 cap applies.

> "You can deduct capital losses only to the extent of capital gains plus, if you are an individual, the lesser of (1) $3,000 ($1,500 if married filing separately), or (2) your total net loss shown on line 16 of Schedule D (Form 1040)." [Pub. 550] — losses offset gains WITHOUT limit; only the excess is subject to the $3,000 cap.

**Current:** Lines 129-131 compute `st` and `lt` (YTD realized net by character) from `capital_gains` and print them into the model context, but those values are scoped inside the try block and discarded. Line 161 then calls `estimateCappedTlhSavings({ unknownLoss: totalLoss, stGainYtd: 0, ltGainYtd: 0 })`, which forces every harvestable dollar past the gain-offset stage and straight into the $3,000 ordinary-income cap. Worked example: a user with $50,000 of realized short-term gains YTD and $50,000 of unrealized losses gets $3,000 × 0.32 = $960, when the statutorily correct estimate is 50,000 × 0.32 = $16,000. The accompanying line 160/164 text then asserts "Estimated tax savings if realized this year: $960 (losses beyond the annual cap carry forward)" — affirmatively telling the user the cap binds and $47,000 carries forward when nothing carries forward at all. This is the context string fed to the

**Correct:** Hoist the `st`/`lt` YTD nets out of the try block (default 0 on failure, as getValueLedger already does at lines 209-222) and pass them: `estimateCappedTlhSavings({ unknownLoss: totalLoss, stGainYtd: st, ltGainYtd: lt })`. The carryforward sentence must be conditional on `estimatedCarryforward > 0` rather than asserted unconditionally.

**Harm:** A user with meaningful realized gains this year is told in chat that harvesting saves ~$960 when it would save many thousands, and is told losses will carry forward when they will not. They rationally skip the harvest and overpay tax; they also see two different 'savings' numbers for the same portfolio depending on which Helm surface they open, which destroys trust in the number that is supposed to be the product's one deterministic dollar.

---

## P1 - lib/tax-analysis.ts:463
**Statute:** IRC 1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** The 'currently holds a related product' branch states as settled law that merely HOLDING a substantially identical security triggers a wash sale, but 1091(a) requires an ACQUISITION inside the 61-day window; a position bought years ago and untouched triggers nothing.

> within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law), or has entered into a contract or option so to acquire, substantially identical stock or securities

**Current:** The branch queries `holdings` with `.in('ticker', relatedTickerList)` and NO date filter and no acquisition test, then for confidence 'definite' emits: 'Wash sale risk: you currently hold {held}. Selling {ticker} at a loss while holding {held} triggers a wash sale per IRC 1091.' For a GOOGL/GOOG holder this fires unconditionally. The position is then flagged washSaleRisk = true, sorted to the bottom of the table (line ~739), rendered with the amber 'Wash-sale' pill, and — critically — skipped by the capped-savings pool (`if (o.washSaleRisk) continue;` at line ~747), so it is also excluded from totalEstimatedSavings. Because this is currently the only detection branch that can fire for a real user (see the finding at line 345), it is simultaneously the app's only wash-sale signal and legally wrong.

**Correct:** Holding alone is not a trigger. This branch should test whether a related-ticker position was ACQUIRED within 30 days before today (holdings.acquired_at, or a buy row in investment_transactions), and where acquisition date is unknown it must be phrased as an unverified possibility ('Helm cannot see when you acquired {held}; if you bought it in the last 30 days this sale may be a wash sale'), never as 'triggers a wash sale per IRC 1091.' The 'definite' confidence tier should be reserved for a confirmed acquisition of a same-issuer share class inside the window.

**Harm:** A user is told, citing the statute by section number, that a sale they are contemplating is a wash sale when it is not, and the estimated savings shown for their portfolio silently omit that lot. The false confidence cuts the other way too: it teaches the user that the trigger is 'holding' rather than 'buying,' which is exactly the misunderstanding that causes real inadvertent wash sales.

---

## P1 - lib/tax-analysis.ts:357
**Statute:** Rev. Rul. 2008-5 (applying IRC 1091(a) and 1091(d)); Pub. 550 wash-sale item (4)  
**Source:** https://www.irs.gov/irb/2008-03_IRB

**Issue:** Every wash-sale message tells the user the disallowed loss is added to the basis of the replacement shares, but under Rev. Rul. 2008-5 a purchase in the user's IRA or Roth IRA disallows the loss PERMANENTLY with no basis increase — and Helm neither detects that case nor discloses it anywhere.

> ISSUE: If an individual sells stock or securities for a loss and causes his or her individual retirement account or Roth IRA to purchase substantially identical stock or securities within 30 days before or after the sale, is the loss on the sale of the stock or securities disallowed? ... HOLDING: The loss on the Sale of stock is disallowed under 1091. A's basis in the individual retirement account or Roth IRA is not increased by virtue of 1091(d).

**Current:** The detail string at line 355-357 says unconditionally: 'The disallowed loss would be added to the cost basis of the replacement shares.' No surface — not this string, not DISCLAIMER (line 564), not the page-level disclaimer (app/dashboard/taxes/page.tsx:1195), not the retirement-positions section — mentions IRA/401(k) purchases at all. Helm HAS the data to check this: isRetirementAccount() (line ~200) already classifies accounts, and the wash-sale queries are not account-scoped, so a same-window buy inside a retirement account is exactly the case the engine is positioned to catch. Instead the engine treats retirement accounts purely as a place where losses are not harvestable (savings = 0, replacement = null, washSaleRisk forced to false at line ~712) and is silent on them as a wash-sale SOURCE.

**Correct:** Split the basis language by case: for a taxable-account replacement, 'the disallowed loss is added to the basis of the replacement shares (1091(d)) and the old holding period tacks on (1223(3))'; for a retirement-account acquisition, 'the loss is permanently disallowed and your IRA basis is NOT increased (Rev. Rul. 2008-5).' Add an explicit check for buys of the harvested ticker in accounts where isRetirementAccount() is true within the 30-day window, surfaced as the highest-severity flag on the row, and add a standing warning near the Harvest CTA that buying the same security in an IRA/401(k)/HSA within 30 days destroys the loss outright.

**Harm:** A user harvests a loss in their taxable brokerage while their IRA auto-invests or rebalances into the same fund inside the window. Helm has told them the worst case is a basis deferral, so they treat it as timing. The deduction is gone forever and the estimated-savings figure Helm quoted is unrecoverable, not merely postponed.

---

## P1 - lib/thesis-actions.ts:172
**Statute:** IRC 1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** The harvest recommendations state only the forward half of the wash-sale window ('do not repurchase within 30 days'), omitting that a purchase already made in the 30 days BEFORE the sale disallows the loss — the half users actually trip over.

> within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired ... substantially identical stock or securities, then no deduction shall be allowed under section 165

**Current:** The 'Harvest the loss on {ticker}?' action tells the user: 'Consider selling {t} to harvest the loss ... Do not repurchase {t} within 30 days or you trigger a wash sale (IRC 1091).' Same one-sided framing in lib/insights-engine.ts:261 ('Wash-sale rule: repurchasing a substantially identical security within 30 days disallows the loss (IRC 1091)') and components/drawers/tax-insight-drawer.tsx:78, which describes the rule as a '30-day period' when 1091 defines a 61-day period. The public marketing page app/tools/tlh-calculator/page.tsx:108 states it correctly ('within 30 days before or after the sale'), so the logged-in surfaces that actually tell a user to sell are the ones with the incomplete rule.

**Correct:** Every surface that recommends a harvest must state both halves: a purchase of a substantially identical security in the 30 days before the sale, the day of the sale, or the 30 days after (61 days total) disallows the loss. The action text should additionally instruct the user to check for recent buys, DRIP reinvestments, and retirement-account purchases before selling, since Helm's own detection cannot see them (see the findings at lines 345 and 357).

**Harm:** A user who added to the position three weeks ago reads Helm's rule as satisfied because they have no intention of repurchasing, sells, and loses the deduction. The action card is the surface that moves them to trade, so the omission is directly causal.

---

## P1 - lib/tax-analysis.ts:463
**Statute:** IRC §1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** The wash-sale explainer tells the user that merely HOLDING a related security triggers a wash sale under §1091; the statute requires an acquisition inside the 61-day window, and this false positive removes a legitimately deductible loss from the user's harvest total.

> where it appears that, within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date, the taxpayer has acquired ... substantially identical stock or securities, then no deduction shall be allowed

**Current:** checkWashSaleRisk queries current `holdings` for related tickers with no date predicate and, on any hit, sets `{ risk: true }` and renders (line 463): "Wash sale risk: you currently hold ${held.ticker} (${match.relationship}). Selling ${ticker} at a loss while holding ${held.ticker} triggers a wash sale per IRC §1091." Line 465 makes the same holding-based claim for the 'likely' tier. Ownership is not acquisition — a taxpayer who has held GOOG since 2019 and sells GOOGL at a loss today has no wash sale. The flag is not cosmetic: generateTaxReport skips every washSaleRisk lot when building the loss pools (line 775), so the position is silently dropped from totalEstimatedSavings and from the §1211(b) netting, and the row is badged "Wash-sale" on screen.

**Correct:** Gate the holdings-based branch on an acquisition date inside the 61-day window (or drop the branch and rely on the transaction-based checks). If it is kept as an advisory-only signal, it must not set risk:true and must not be excluded from the savings pool; reword to: "Heads up: you also hold ${held.ticker} (${match.relationship}). Holding it is not itself a wash sale — IRC §1091 is triggered only if you ACQUIRE a substantially identical security in the 30 days before or after the sale. If you have bought, or plan to buy, ${held.ticker} in that window, the loss may be disallowed." Line 465 needs the same correction.

**Harm:** A GOOGL/GOOG, SPY/VOO or NVDA/NVDL holder is told a deductible loss is unavailable and is shown a smaller "Est. saving" than the law allows, so a real §1211(b) deduction goes unclaimed.

---

## P1 - app/dashboard/taxes/page.tsx:1193
**Statute:** IRC §1411(a)-(b) (3.8% net investment income tax above $200,000 / $250,000 MAGI, thresholds not indexed); IRC §1(h) / IRS Topic No. 409 (long-term rate is 0%, 15% or 20% depending on taxable income, not a constant 15%)  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** The comprehensive disclaimer the engine builds and flags as mandatory is never rendered; the footer that is rendered states a bare "32% blended tax rate" without disclosing that it is a hardcoded default, that long-term losses are valued at an assumed 15%, that the §1411 NIIT is excluded, or that state tax treatment is excluded.

> 0% rate applies to taxable income up to $48,350 (single); $96,700 (married filing jointly) ... 15% rate applies to income above those thresholds up to $533,400 (single); $600,050 (married filing jointly) ... 20% rate applies to income exceeding the 15% threshold

**Current:** lib/tax-analysis.ts builds DISCLAIMER (lines 564-571) — which does name NIIT, AMT, state rules, cross-account wash sales and "Helm Terminal is not a registered tax advisor" — returns it on every report, and marks the field "Legal disclaimer — MUST be displayed to users" (line 97). It is typed through to the client (hooks/use-financial-data.ts:675) and then dropped: grep for `disclaimer`, `NIIT`, `1411`, `3.8`, `state tax` or `federal` across app/dashboard/taxes/page.tsx returns nothing. The only rendered text is the hardcoded footer at lines 1193-1197: "All figures are estimates based on a 32% blended tax rate and your connected portfolio data." Meanwhile lib/financial-config.ts:13 documents TAX_RATE as a "Combined federal + state" rate while LTCG_RATE_DEFAULT:16 is documented as "15% federal", so the two rates on the same screen are not on the same basis — and the page presents both as 

**Correct:** Render `harvestReport.disclaimer` instead of the hardcoded paragraph, and extend it to cover what is now missing. Replace lines 1194-1197 with: "Estimates only, not tax advice. Helm Terminal is not a registered tax advisor, CPA, or tax return preparer. Figures assume a default 32% ordinary/short-term rate and a default 15% long-term rate — not your actual brackets, which depend on your taxable income and filing status (IRC §1(h)). They exclude the 3.8% net investment income tax (IRC §1411, which applies above $200,000 single / $250,000 joint MAGI), AMT, state and local tax, prior-year loss carryovers, and wash sales in accounts you have not linked. Cost basis comes from your brokerage feed and may differ from your Form 1099-B. Consult a qualified tax professional before acting." Also relabel lines 869 and 916 from "~32% rate" / "~15% rate" to "assumed 32%" / "assumed 15%".

**Harm:** The product's target user is a $100k+ multi-brokerage investor — exactly the population over the §1411 thresholds. They are shown an "Est. tax owed" that is understated by 3.8% of their net investment income and an "Est. saving" priced at rates that are not theirs, with nothing on screen telling them which assumptions were made.

---

## P1 - lib/thesis-conviction.ts:47
**Statute:** IRC §1091(a) (61-day window runs 30 days BEFORE as well as after); Rev. Rul. 2008-5, 2008-3 I.R.B. 271 (rebuy inside an IRA: loss disallowed with no §1091(d) basis restoration)  
**Source:** https://www.irs.gov/irb/2008-03_IRB

**Issue:** The Tax Center renders directive sell/rebuy instructions that (a) are securities and tax recommendations from a firm that states it gives neither, and (b) describe the wash-sale constraint as purely a matter of waiting, omitting the account- and person-scope rules that make the loss permanently unrecoverable.

> The loss on the Sale of stock is disallowed under § 1091. A's basis in the individual retirement account or Roth IRA is not increased by virtue of § 1091(d).

**Current:** thesisTlhNote is rendered verbatim in the Tax Center at app/dashboard/taxes/page.tsx:1529 and :1672, next to the position's dollar figures. Line 47: "Your thesis is intact. This looks like a tax move, not a change of conviction. Consider rebuying after the wash-sale window to stay positioned." Line 45: "If you harvest, consider waiting out the wash-sale window before rebuying." Line 43: "consider whether you still want to own it at all, rather than simply rebuying after the wash-sale window." The function's own docstring claims it is "RIA-safe... never a directive," and lib/ai-guardrail.ts bans exactly these verbs for AI output: "Do not use imperative transaction verbs (buy, sell, trim, reduce, add, harvest, rebalance, exit, cut, hold...)." The deterministic UI copy is held to a looser standard than the model output. Substantively, "rebuying after the wash-sale window" tells the user the

**Correct:** Strip the transaction directive and state the rule completely. Line 47: "Your thesis is intact, so a harvest here reads as a tax move rather than a change of conviction. Note that IRC §1091 disallows the loss if a substantially identical security is acquired in the 30 days before or after the sale — in any of your accounts, by your spouse, or by your IRA. An IRA repurchase is worse than an ordinary wash sale: Rev. Rul. 2008-5 disallows the loss with no basis restoration." Line 45: "Your thesis here is weakening, and the next data point is the one to watch. If a loss is realized, the §1091 61-day window applies as described above." Line 43: "Your thesis on this position is broken. The tax loss and the conviction signal point the same way; what you do with the position is your call." Then either update the docstring or route this copy through the same hasAdviceLanguage check the model outp

**Harm:** A user follows "consider rebuying after the wash-sale window to stay positioned," repurchases in their IRA on day 31 after having also bought within the 30 days before the sale, and permanently loses a deduction the screen implied was preserved — on advice from a company whose clickwrap says "Helm is information, not advice."

---

## P1 - app/api/tax/form-8949/route.ts:138
**Statute:** Instructions for Form 8949 (2025), Part I boxes A/B/C and Part II boxes D/E/F; column (b) Date acquired; column (f) code W and column (g) nondeductible wash-sale loss  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** The Form 8949 export is marketed as "IRS-ready" but omits the mandatory Part I / Part II box designation, hardcodes every column (f)/(g) adjustment to zero, and fills column (b) with the earliest buy date on record for the ticker rather than the acquisition date of the lot actually sold.

> You must check one box—A, B, or C ... Box A applies to transactions reported to you on Form 1099-B or Form 1099-DA (or substitute statement) with an amount shown for cost or other basis [where basis was reported to the IRS] ... For wash sales, enter code W and report the sale or exchange on Form 8949 and enter the amount of the nondeductible loss as a positive number in column (g).

**Current:** buyDates is built from an unfiltered `capital_gains` buy query ordered ascending with first-write-wins per ticker (lines 114-128), so a 2015 purchase supplies the (b) Date acquired for a 2026 sale of a 2025 lot; the fallback is the literal string 'Various' (line 140) even for a single-lot sale, whereas the instructions permit VARIOUS only when one row aggregates stock acquired on multiple dates. `adjustment: 0` is hardcoded on every row (line 144) and there is no column (f) code field at all, so a broker-reported wash-sale adjustment never appears. The Form8949Part type carries no box designation, and components/dashboard/form-8949-preview.tsx renders headers (a),(b),(c),(d),(e),(h) with no A/B/C or D/E/F selector. The product nonetheless sells "an IRS-ready Form 8949" (app/dashboard/taxes/page.tsx:265) and the preview header reads "IRS Form 8949" (preview line 462). The preview footer d

**Correct:** Stop calling it IRS-ready. Change app/dashboard/taxes/page.tsx:265 to "...and a Form 8949 worksheet you can reconcile against your 1099-B" and the preview label at line 462 to "Form 8949 worksheet (not a filing copy)." Either populate the box designation from whether basis was reported on the 1099-B, or default to Box C / Box F and label it, since Helm receives no 1099-B. Emit dateAcquired only from a lot-level acquisition date; where none exists, output the empty string and a per-row note rather than an unrelated ticker-level date. Extend the preview footer to: "This worksheet is not a filed Form 8949. It does not select the required Part I box (A/B/C) or Part II box (D/E/F), does not compute column (f) codes or column (g) adjustments including wash-sale code W, and column (b) is derived from your transaction feed rather than from lot-level acquisition records. Reconcile every row again

**Harm:** A Pro subscriber transcribes a wrong acquisition date and a zeroed wash-sale adjustment onto a filed return, and files a Form 8949 with no box checked — a return that is facially incomplete under the Form 8949 instructions and understates disallowed losses.

---

## P1 - app/api/tax/form-8949/route.ts:155
**Statute:** Form 8949 Instructions, box selection for Part I and Part II  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** The export carries no Box A/B/C (Part I) or Box D/E/F (Part II) designation, and the app never captures whether basis was reported to the IRS, so the form cannot be completed or carried to Schedule D.

> Report on Part I with box A or box G checked all short-term transactions reported to you on Form 1099-B or Form 1099-DA (or substitute statement) with an amount shown for cost or other basis unless the statement indicates that amount wasn't reported to the IRS. ... Check only one box on each Part I. ... Complete as many copies of Part I as you need to report all transactions of each type (A, B, C, G, H, or I).

**Current:** buildPart() emits exactly one Part I and one Part II carrying only a `label` and a prose `subtitle`. There is no box field on Form8949Part or Form8949Row, nothing in the schema records whether basis was reported to the IRS, and the CSV header at components/dashboard/form-8949-preview.tsx:52 has no box column. The preview table headers (form-8949-preview.tsx:145-152) render only (a)(b)(c)(d)(e)(h).

**Correct:** Record, per transaction, whether a Form 1099-B was received and whether basis was reported to the IRS; then split rows into separate box-scoped parts and emit the box letter on every row and in the CSV. If that data is unavailable, label the whole export as Box C / Box F (no Form 1099-B received) and say so on the artifact, so the user does not silently file un-boxed rows.

**Harm:** A user transcribing this onto Form 8949 has no basis for checking a box and either leaves all boxes unchecked or guesses. Schedule D lines 1b/2/3 and 8b/9/10 are keyed to the box checked, so the totals land on the wrong Schedule D line, and un-boxed 8949 pages are not processable.

---

## P1 - app/api/tax/form-8949/route.ts:144
**Statute:** Form 8949 Instructions, Column (f)/(g) and adjustment code W; Column (h) computation; IRC §1091  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** Column (f) Code does not exist in the output and column (g) Adjustment is hardcoded to 0, so the downloaded CSV affirmatively asserts a zero wash-sale adjustment on every row — with no disclaimer travelling with the file — even though the app already runs wash-sale detection.

> You have a nondeductible loss from a wash sale. Report the sale or exchange on Form 8949 and enter the amount of the nondeductible loss as a positive number in column (g). ... First, subtract the cost or other basis in column (e) from the proceeds (sales price) in column (d). Then take into account any adjustments in column (g). Enter the gain (or loss) in column (h).

**Current:** route.ts:144 sets `adjustment: 0` unconditionally and no `code` field exists on Form8949Row. components/dashboard/form-8949-preview.tsx:63 writes `row.adjustment.toFixed(2)` → literal '0.00' on every CSV row, under a header (line 52) that has an 'Adjustment' column but no 'Code' column. generateCSV emits no disclaimer text at all, so the in-app caveat at form-8949-preview.tsx:590-594 ('Adjustments (column g) are not computed') does not reach the downloaded or copied artifact — which is the thing that goes to the preparer. Meanwhile lib/tax-analysis.ts checkWashSaleRisk() already detects same-ticker and related-product wash sales and that result never reaches this route.

**Correct:** Emit an empty or explicitly 'NOT COMPUTED' adjustment rather than a numeric 0.00; add a column (f) Code column; prepend the disclaimer as comment/header rows inside the CSV itself; and where a wash sale is detected, populate code W with the disallowed loss as a positive number in column (g) and recompute column (h) as (d) − (e) + (g).

**Harm:** A user with a wash sale in the year downloads a file stating adjustment $0.00 and a full loss in column (h), and deducts a loss that IRC §1091 disallows — understating tax and exposing them to an accuracy-related penalty. The one sentence that would have prevented it is stripped out of the exported file.

---

## P1 - app/api/tax/form-8949/route.ts:91
**Statute:** Schedule D (Form 1040) Instructions — the return and its Form 8949 report dispositions for the tax year of the return  
**Source:** https://www.irs.gov/instructions/i1040sd

**Issue:** Tax year is hardcoded to the server's current calendar year, so during the filing season the form for the year actually being filed is unreachable and the export is labelled with a year that cannot be filed yet.

> Complete Form 8949 before you complete line 1b, 2, 3, 8b, 9, or 10 of Schedule D. ... [these instructions apply to] 2025 tax year transactions filed on the 2025 Schedule D (Form 1040).

**Current:** `const currentYear = new Date().getFullYear()` (line 91) is used for both `.eq('tax_year', currentYear)` (line 98) and the returned `taxYear` (line 168), which becomes the CSV filename `form-8949-TY${data.taxYear}-helm.csv` and the 'IRS Form 8949 · TY {year}' badge. There is no year selector anywhere in the UI, and the year comes from server-local time rather than the user's.

**Correct:** Default to the most recent completed tax year while filing season is open (or expose an explicit year selector) and pin the label to the data actually returned, so the badge, filename, and rows always agree on one filable year.

**Harm:** A Pro user preparing their 2025 return in March 2026 opens 'Preview Form 8949', is shown 'TY 2026', and either sees an empty form (concluding they had no reportable sales) or sees two months of 2026 trades and files current-year dispositions on a prior-year return. Either way the 2025 transactions they actually owe tax on are unreachable from the product.

---

## P1 - app/api/tax/form-8949/route.ts:148
**Statute:** IRS Topic No. 409, Capital Gains and Losses — holding period determines short-term vs long-term  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** Any sell whose gain_loss_type is NULL or unrecognized is silently classified long-term and placed in Part II.

> Generally, if you hold the asset for more than one year before you dispose of it, your capital gain or loss is long-term. If you hold it one year or less, your capital gain or loss is short-term. To determine how long you held the asset, you generally count from the day after the day you acquired the asset up to and including the day you disposed of the asset.

**Current:** `if (tx.gain_loss_type === 'short_term') { shortTermRows.push(row); } else { longTermRows.push(row); }` — the else branch is a catch-all. supabase/migrations/008_create_tax_management.sql:56 declares `gain_loss_type TEXT CHECK (gain_loss_type IN ('short_term','long_term'))` with no NOT NULL, so NULL is a permitted stored value and lands in Part II. lib/tax-analysis.ts classifyHoldingPeriod() likewise has an 'unknown' return value that this route has no bucket for.

**Correct:** Test explicitly for 'long_term' and route NULL/unknown to a third, visibly flagged 'unclassified — verify holding period against your 1099-B' bucket; if a default is unavoidable, default to short-term, which errs toward the taxpayer's disadvantage rather than toward an unsupported preferential rate.

**Harm:** A short-term gain with a missing classification is reported in Part II, flows to the long-term section of Schedule D, and is taxed at 0/15/20% instead of ordinary rates — an understatement of tax on the user's own return, in the direction that draws penalties rather than a refund.

---

## P1 - app/dashboard/taxes/page.tsx:265
**Statute:** Form 8949 Instructions — required box selection and columns (a) through (h)  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** The Tax Center is marketed as producing an 'IRS-ready Form 8949', which the export is not — it has no box designation, no column (f) or (g), inferred acquisition dates, and only current-year data.

> Check only one box on each Part I. ... In order to explain any adjustment to gain (or loss) in column (g), enter the appropriate code(s) in column (f).

**Current:** TierLock blurb reads: "Tax-lot tracking, wash-sale-safe harvesting, and an IRS-ready Form 8949 across your connected accounts." This directly contradicts the product's own disclaimer eleven lines of UI later (components/dashboard/form-8949-preview.tsx:590-594): 'For informational purposes only... Adjustments (column g) are not computed.' It also claims tax-lot tracking, while the export derives acquisition dates from an earliest-buy heuristic and lib/tax-analysis.ts:12 states 'Specific lot identification — NOT implemented (uses average cost basis).'

**Correct:** Describe the artifact as a Form 8949 worksheet or draft for review with a tax professional, consistent with the disclaimer already rendered on the panel, and drop 'IRS-ready' and 'tax-lot tracking' until specific-lot identification and columns (f)/(g) actually exist.

**Harm:** A paying user relies on the 'IRS-ready' promise, downloads the CSV, and files from it without reconciling to the 1099-B — filing a return with invented acquisition dates, no box checked, and disallowed wash-sale losses deducted.

---

## P1 - lib/tax-analysis.ts:523
**Statute:** IRC §1222(3) (long-term = capital asset held "for more than 1 year"); Instructions for Form 8949 / Topic No. 409, holding-period counting rule  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** classifyHoldingPeriod uses elapsed-day arithmetic (diffDays > 365) instead of the IRS anniversary rule, so positions are tagged long-term up to a full day and a half early.

> To determine how long you held the asset, you generally count from the day after the day you acquired the asset up to and including the day you disposed of the asset. ... Generally, if you hold the asset for more than one year before you dispose of it, your capital gain or loss is long-term.

**Current:** const acquired = new Date(acquiredAt + 'T12:00:00'); const diffDays = (Date.now() - acquired) / 86400000; return diffDays > 365 ? 'long_term' : 'short_term'. Two distinct failure modes. (1) Anniversary day, non-leap window: acquired 2025-08-04, evaluated 2026-08-04 at any time after 12:00 local → diffDays = 365.4 > 365 → 'long_term'. Per the IRS rule, counting starts 2025-08-05 and includes 2026-08-04, which is exactly one year, not MORE than one year → short-term. (2) Leap-spanning window: acquired 2023-03-01, evaluated 2024-03-01 → 366 elapsed days → 'long_term' all day, even though 2024-03-01 is the anniversary and is still short-term; it is also wrong from noon on 2024-02-29. The 'T12:00:00' anchor makes the flip time-of-day dependent, so the same position renders ST in the morning and LT in the afternoon.

**Correct:** Classify on calendar dates, not elapsed days: long_term only when the evaluation date is strictly after the one-year anniversary of the acquisition date (i.e. acquisition date + 1 year + 1 day, per the Form 8949 instruction 'begin counting on the day after you received the property and include the day you disposed of it'). Compare date-only values so the result cannot change with the clock. This function drives the ST/LT badge rendered at app/dashboard/taxes/page.tsx:1465 and :1549, the per-position rate in calculateSavings, and the stLossPool/ltLossPool split fed to estimateCappedTlhSavings, so the error propagates to every TLH dollar.

**Harm:** A user is shown an 'LT' badge on the anniversary date and can sell believing the gain qualifies for the §1(h) preferential rate when it is in fact taxed as ordinary income — on a $50,000 gain that is roughly $8,500 of unexpected tax at the app's own 32%/15% defaults. In the loss direction it silently values a short-term harvestable loss at 15% instead of 32%, understating the estimate.

---

## P1 - app/api/ai/analyze/route.ts:322
**Statute:** IRC §1(h) (adjusted net capital gain taxed at 0%/15%/20%, not ordinary rates); IRC §1222(11)  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** The AI's grounded tax context applies the 32% ordinary/short-term rate to the entire net realized gain, including long-term gain, even though the surrounding lines already computed the long-term amount separately.

> A capital gains rate of 15% applies if your taxable income is [within the defined ranges] ... However, a capital gains rate of 20% applies to the extent that your taxable income exceeds the thresholds set for the 15% capital gain rate.

**Current:** lines.push(`Estimated tax on realized gains (${(TAX_RATE * 100).toFixed(0)}% blended): $${fmt(Math.max(0, net) * TAX_RATE)}`) where net = stGains + stLosses + ltGains + ltLosses. The ltGains variable computed at line 315 is never used in the rate calculation. A user with $0 short-term and $50,000 of long-term realized gain gets the line 'Estimated tax on realized gains (32% blended): $16,000'. Using the app's own LTCG_RATE_DEFAULT the figure is $7,500 — the string overstates by 113%, and the LLM quotes it back verbatim as a grounded number.

**Correct:** Apply the rate by character after §1222(11) netting, exactly as app/dashboard/taxes/page.tsx:282-296 already does: net short-term against long-term first, then tax any residual net short-term gain at TAX_RATE and any residual net capital gain (net LT gain over net ST loss) at LTCG_RATE_DEFAULT. Relabel the parenthetical so it names both rates rather than calling a single ordinary rate 'blended'.

**Harm:** The user asks the assistant what they owe on this year's sales and is told a number that can be more than double the correct estimate for a long-term-heavy book, which can push them into harvesting or deferring sales they did not need to make.

---

## P1 - lib/research/account.ts:139
**Statute:** IRC §1222(11) (net capital gain = net long-term capital gain over net short-term capital loss); IRC §1(h)(1); Pub. 550 capital gain/loss netting  
**Source:** https://www.irs.gov/publications/p550

**Issue:** getTaxContext computes estimated tax on realized gains with Math.max(0, st) and Math.max(0, lt) independently, discarding the mandatory netting of short-term losses against long-term gains (and vice versa).

> Short-term losses must be used first to offset short-term gains. Long-term losses offset long-term gains. Only after exhausting losses within each category can excess losses cross over: short-term losses can then offset long-term gains (and vice versa).

**Current:** `Math.max(0, st) * TAX_RATE + Math.max(0, lt) * LTCG_RATE_DEFAULT`. A user with a $10,000 net short-term LOSS and a $20,000 net long-term gain gets: max(0, -10000)*0.32 + 20000*0.15 = $3,000. After the netting §1222(11) requires, net capital gain is $10,000 and the estimate should be $1,500 — a 100% overstatement. The block is consumed by lib/research/retrieve.ts:67 (research chat) and lib/research/analyst-note.ts:96 (weekly note), so the wrong figure is presented as grounded portfolio fact in prose.

**Correct:** Net st and lt against each other before applying rates: if both are positive, tax each at its own rate; if one is negative, apply the surviving character's rate to the combined residual and show $0 when the combined figure is <= 0. app/dashboard/taxes/page.tsx:282-296 already contains a correct implementation of this — reuse it rather than keeping a second, non-netting formula.

**Harm:** A user who harvested short-term losses earlier in the year is told by the chat and the weekly note that they still owe tax on the full long-term gain, so the losses they already realized appear to have bought them nothing.

---

## P2 - lib/financial-config.ts:25
**Statute:** IRC §1211(b)(1); IRS Topic No. 409; Pub. 550  
**Source:** https://www.law.cornell.edu/uscode/text/26/1211

**Issue:** The §1211(b) cap is a global env constant defaulting to $3,000 and is never derived from the user's filing status, even though the app collects and stores filing status including "Married Filing Separately", for whom the statutory limit is $1,500.

> "...the lower of— (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains." [IRC §1211(b)]

**Current:** `ANNUAL_LOSS_DEDUCTION_CAP = Number(process.env.TAX_ANNUAL_LOSS_CAP) || 3_000` is process-wide. The code comment on lines 23-24 says "Override via env for MFS users" — but env is a single deploy-wide value, so it cannot be per-user, and no caller of `estimateCappedTlhSavings` or `generateTaxReport` reads filing status. Meanwhile app/dashboard/settings/page.tsx:1491-1504 presents a filing-status picker including 'Married Filing Separately', persists it via app/api/user/preferences/route.ts:83 into `user_preferences.filing_status` (supabase/migrations/035_tax_settings.sql:5), and the section header promises it is used "for accurate tax-loss harvesting analysis." The user-facing copy then asserts the wrong number outright: app/dashboard/taxes/page.tsx:563 renders "Net capital losses offset up to $3,000 of ordinary income", and the DISCLAIMER at lib/tax-analysis.ts:565-566 states "The $3,000

**Correct:** Read `user_preferences.filing_status` and resolve the cap per user: $1,500 when filing_status === 'Married Filing Separately', otherwise $3,000. Thread it through `estimateCappedTlhSavings` as a parameter (alongside `ordinaryRate`/`ltcgRate`) rather than importing the module constant, and render the resolved value in the tracker copy and the disclaimer instead of the hardcoded string "$3,000". If per-user resolution is not shipped, remove the filing-status control or state plainly that it is not yet applied, so the settings page stops promising accuracy it does not deliver.

**Harm:** A married-filing-separately user who explicitly told Helm their filing status sees every tax-loss-harvesting savings figure inflated by up to $480/yr and their carryforward understated by $1,500, and the disclaimer tells them the correct cap was applied when it was not.

---

## P2 - lib/research/account.ts:241
**Statute:** IRC §1222(11) and §1211(b); Pub. 550 netting rules / Schedule D  
**Source:** https://www.irs.gov/publications/p550

**Issue:** Three of the four production call sites collapse all harvestable losses into `unknownLoss` (treated as long-term) while generateTaxReport splits them by real holding period, so the same user sees materially different §1211(b) savings on different Helm surfaces on the same day.

> "the amount by which your net long-term capital gain for the year is more than your net short-term capital loss for the year" [Topic No. 409, defining net capital gain] — the preferential rate reaches only the residual net long-term gain, so which gain a loss absorbs determines the rate at which the loss saves tax.

**Current:** lib/research/account.ts:161 and :241, lib/insights-engine.ts:242, and lib/thesis-actions.ts:370 all pass `unknownLoss: <every dollar of loss>`. Per the estimator (line 622) unknown is pooled with long-term, which absorbs LT gain at the LTCG rate first. generateTaxReport (lib/tax-analysis.ts:771-789) instead splits into stLossPool/ltLossPool/unknownLossPool from `classifyHoldingPeriod`. The unknown→LT default is genuinely conservative, not wrong — total absorbed is `min(loss, stGain+ltGain)` under either character, and LT ordering takes the low-rate gain first, so it can only understate — but it is not consistent. Worked example: a user with a genuinely short-term $5,000 harvestable loss, $5,000 realized ST gain and $5,000 realized LT gain sees 5,000 × 0.32 = $1,600 in the Tax Center (character-split) and 5,000 × 0.15 = $750 in the Actions Inbox, the daily brief, and the research chat (al

**Correct:** Pass real loss character at every call site. The holding-period data already exists — `classifyHoldingPeriod(h.acquired_at)` is used inside generateTaxReport — so these surfaces should build the same stLoss/ltLoss/unknownLoss split (or simply call generateTaxReport and read `annualCap.cappedSavings`) rather than dumping everything into `unknownLoss`. Where `acquired_at` is genuinely null, `unknownLoss` remains the correct conservative bucket; it should not be the default for lots whose acquisition date is known.

**Harm:** A user comparing the Tax Center headline against the same day's brief, actions inbox, or chat answer sees two different dollar figures for the identical harvest — up to 2x apart — with no explanation, and the lower figure may lead them to skip a harvest that is in fact worth more than twice what the assistant told them.

---

## P2 - lib/tax-analysis.ts:355
**Statute:** IRC 1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** A prior SELL of the ticker within 30 days is flagged as a wash-sale risk on a new sale; 1091 is triggered by an acquisition, not by a preceding disposition, so selling the rest of a position after an earlier loss sale is not a wash sale.

> the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law), or has entered into a contract or option so to acquire, substantially identical stock or securities

**Current:** The loop sets a risk flag for BOTH transaction types ('const txType = tx.transaction_type === "sell" ? "Sold" : "Bought"') and emits the same conclusion for each: 'Sold on {date} — within 30-day wash sale window. Per IRC 1091, selling at a loss now may trigger a wash sale. The disallowed loss would be added to the cost basis of the replacement shares.' The position is then marked washSaleRisk = true, shown with the amber 'Wash-sale' pill, sorted to the bottom, and dropped from the capped-savings pool.

**Correct:** A prior sell should not set washSaleRisk. If it is worth surfacing at all, it belongs as neutral context ('you sold {ticker} on {date}; a repurchase within 30 days of that sale would disallow that loss'), which is a statement about the EARLIER sale, not about the sale being contemplated now. Only acquisitions inside the window should drive the risk flag.

**Harm:** A user who already trimmed the position is told the remaining lot is a wash-sale conflict, is discouraged from a legitimate harvest, sees the lot excluded from the estimated-savings total, and takes away an incorrect model of what triggers 1091.

---

## P2 - lib/tax-analysis.ts:564
**Statute:** IRC 1091(a)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1091

**Issue:** The user-facing DISCLAIMER enumerates what is excluded from the estimate but omits the two exclusions most likely to void a harvest — undetected same-account purchases (including automatic dividend reinvestment) and retirement-account purchases — while the code header acknowledges both gaps internally.

> the taxpayer has acquired (by purchase or by an exchange on which the entire amount of gain or loss was recognized by law) ... substantially identical stock or securities, then no deduction shall be allowed under section 165

**Current:** The header comment at lines 11-14 records '⚠️ Cross-account wash sale aggregation — NOT implemented' and '⚠️ Dividend reinvestment wash sales — NOT implemented (requires DRIP data)'. Neither reaches a user. DISCLAIMER (line 564) instead asserts the opposite emphasis — 'wash sale rules (IRC 1091) ... are factored into these estimates' — and its exclusion list names only cross-account aggregation, AMT, NIIT, and state rules. The page-level disclaimer (app/dashboard/taxes/page.tsx:1195) says only that 'Wash sale rules (IRC 1091) ... apply.' An automatic DRIP purchase is an acquisition by purchase under 1091(a) and is the single most common inadvertent trigger for buy-and-hold investors, who are Helm's stated ICP.

**Correct:** Move both acknowledged gaps into the user-facing disclaimer verbatim: state that Helm does not see dividend reinvestment purchases, does not aggregate acquisitions across accounts, and does not detect purchases made in retirement accounts, and that any of the three can disallow a loss Helm has shown as harvestable. Drop or qualify 'wash sale rules ... are factored into these estimates' until the detection at line 345 actually runs against populated data.

**Harm:** A user with DRIP enabled on a dividend-paying position sees it listed as 'Eligible,' harvests, and the reinvestment that settled inside the window disallows the loss on those shares. Helm both failed to detect it and told the user wash-sale rules were factored in.

---

## P2 - lib/tax-analysis.ts:515
**Statute:** IRC 1223(3)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1223

**Issue:** classifyHoldingPeriod derives short-term vs long-term solely from acquired_at, with no tacking for shares acquired in a prior wash sale, so replacement lots can be shown in the 'Term' column as short-term — and valued at the ordinary rate — when 1223(3) makes them long-term.

> In determining the period for which the taxpayer has held stock or securities the acquisition of which (or the contract or option to acquire which) resulted in the nondeductibility (under section 1091 relating to wash sales) of the loss from the sale or other disposition of substantially identical stock or securities, there shall be included the period for which he held the stock or securities the loss from the sale or other disposition of which was not deductible.

**Current:** classifyHoldingPeriod(acquiredAt) returns long_term purely on `diffDays > 365` from Plaid's acquired_at, which for replacement shares is the replacement purchase date. There is no tacking adjustment anywhere in the engine, and 1223(3) is not mentioned in DISCLAIMER (line 564), in any wash-sale detail string, or on the taxes page — which lists holding-period requirements only as 'IRC 1222'. The misclassification feeds calculateSavings() (line ~536), so the lot is valued at the ordinary rate (TAX_RATE, 0.32) instead of LTCG_RATE_DEFAULT (0.15), and it is routed into the stLoss pool rather than ltLoss in estimateCappedTlhSavings.

**Correct:** Where Helm knows a lot replaced a wash-sold position, tack the prior holding period per 1223(3) before classifying. Where it cannot know, disclose that the term shown is derived from the broker's acquisition date and does not reflect wash-sale tacking, so a lot shown as short-term may in fact be long-term. Cite 1223(3) alongside 1222 in the holding-period disclaimer.

**Harm:** A user whose replacement shares carry a tacked long-term holding period sees them labeled 'Short' and sees an estimated saving computed at 32% rather than 15% — an overstatement of the benefit, and a wrong term on a surface that also produces a Form 8949 export.

---

## P2 - app/dashboard/taxes/page.tsx:547
**Statute:** IRC §1211(b)(1); IRS Topic No. 409; Instructions for Schedule D (Form 1040)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1211

**Issue:** The §1211(b) tracker presents $3,000 as the user's cap with no filing-status qualifier; the statutory amount is $1,500 for a married individual filing separately.

> the lower of—(1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains

**Current:** The section header reads "§1211(b) Ordinary Income Offset" and the meter shows `{deductionUsed} of {ANNUAL_LOSS_DEDUCTION_CAP}` (line 547) with the progress bar and the copy at line 563 hardcoding the figure: "Net capital losses offset up to $3,000 of ordinary income." ANNUAL_LOSS_DEDUCTION_CAP defaults to 3_000 in lib/financial-config.ts:25, overridable only by a server-wide TAX_ANNUAL_LOSS_CAP env var — there is no per-user filing status anywhere in the app, so an MFS user is shown, and has their carryforward computed against, a cap that is double the law. The config comment at line 23 acknowledges this ("Default assumes single/MFJ. Override via env for MFS users") but the acknowledgement never reaches the screen.

**Correct:** Add the qualifier to the rendered copy. Line 563: "Net capital losses offset up to $3,000 of ordinary income per year ($1,500 if you are married filing separately — IRC §1211(b)). Helm assumes $3,000; excess losses carry forward indefinitely under IRC §1212(b)." Line 547 should render "{deductionUsed} of $3,000 (assumed)". The durable fix is a filing-status field on the profile feeding ANNUAL_LOSS_DEDUCTION_CAP per user.

**Harm:** An MFS filer is shown twice the deduction they are entitled to and a carryforward figure that is $1,500 too small, and plans a year-end harvest around it.

---

## P2 - lib/research/account.ts:166
**Statute:** IRC §1211(b) (losses offset capital gains without limit; only the excess is capped at $3,000); IRC §1212(b) (carryforward)  
**Source:** https://www.law.cornell.edu/uscode/text/26/1211

**Issue:** The stated assumption does not match the computation: the note claims the harvestable-savings figure is "an estimate at a blended rate," but the call deliberately zeroes out the user's realized gains, so the figure is capped at $3,000 × the ordinary rate no matter how large the losses are.

> the lower of—(1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains

**Current:** getTaxContext computes st and lt YTD realized at lines 130-131 and prints them, then two dozen lines later calls `estimateCappedTlhSavings({ unknownLoss: totalLoss, stGainYtd: 0, ltGainYtd: 0 })` (line 161), discarding the gains it just computed. With both gains at zero the estimator's netting stages are no-ops and the result is always `min(totalLoss, 3000) * ordinaryRate` — $960 at the default 32%. The rendered note at line 166 then says "Note: estimate at a blended rate, before wash-sale checks. Not tax advice," but no blend is applied and no rate is named. The sibling function getValueLedger in the same file does it correctly at line 241, passing the real stYtd/ltYtd, so the chat surface and the value ledger can quote two different savings figures from the same book on the same day.

**Correct:** Pass the real characters — `estimateCappedTlhSavings({ unknownLoss: totalLoss, stGainYtd: st, ltGainYtd: lt })` — matching getValueLedger, and then make the note describe what was actually done. Replace line 166 with: "Estimate. Losses first offset your realized gains dollar-for-dollar (IRC §1211(b)); only the excess is deductible against ordinary income, capped at $3,000/year, with the rest carrying forward under IRC §1212(b). Assumes a 32% ordinary rate and a 15% long-term rate, taxable accounts only, before wash-sale checks. Not tax advice."

**Harm:** A user with realized gains asks the chat how much they could save and is quoted a figure floored at $960 while the ledger on another screen shows a much larger number — and the caption tells them a "blended rate" was used when it was not.

---

## P2 - app/dashboard/brief/page.tsx:482
**Statute:** IRC §1001(a) (gain or loss is measured against adjusted basis, not against a prior day's price); IRC §1211(b) (only a realized capital loss is deductible)  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** The daily brief tells the user that positions "carry potential harvestable losses" based purely on a one-day price move, with no reference to cost basis — a position with a large unrealized gain that fell 3% today is listed as a tax-loss candidate.

> if you hold the asset for more than one year before you dispose of it, your capital gain or loss is long-term ... the amount of the excess loss that you can claim to lower your income is the lesser of $3,000 ($1,500 if married filing separately)

**Current:** Line 371 builds the candidate list as `data.allHoldings.filter(h => h.changePct < -3)` — a same-day percentage move — and line 482 renders it under category 'Tax' with meta 'Actionable': "${tickers} carry potential harvestable losses. The Tax Center checks cost basis and wash-sale windows before you act," with a CTA labeled "Open harvester" and a byline "Source · Helm tax engine." No basis comparison occurs at any point; the actual harvestable test that the rest of the codebase uses is `isHarvestableLoss` in lib/tax-analysis.ts, which requires `unrealised_gain_loss < 0` and a priced position. The trailing sentence concedes basis has not been checked while the leading sentence asserts a loss exists.

**Correct:** Either filter on unrealized loss versus basis using the existing isHarvestableLoss helper, or stop framing the card as tax. If it stays a day-move card, replace line 482 with: "${tickers} moved down more than 3% today. That is a price move, not a tax loss — a harvestable loss requires the position to be below your cost basis in a taxable account. Open the Tax Center to see which of your lots actually qualify." and relabel the CTA from "Open harvester" to "Open Tax Center" and the meta from 'Actionable' to 'For review'.

**Harm:** A user acts on a brief that labels a profitable position a harvesting candidate, sells, and realizes a taxable gain instead of the deduction the card implied.

---

## P2 - app/api/tax/form-8949/route.ts:142
**Statute:** Form 8949 Instructions, Column (h)—Gain or (Loss)  
**Source:** https://www.irs.gov/instructions/i8949

**Issue:** Proceeds, cost basis, and gain/loss are each read from separate DB columns and independently coerced to 0, so column (h) is never derived from (d) and (e) and a partially-populated row prints an arithmetically impossible line.

> Figure gain (or loss) on each row. First, subtract the cost or other basis in column (e) from the proceeds (sales price) in column (d). Then take into account any adjustments in column (g). Enter the gain (or loss) in column (h).

**Current:** `proceeds: Number(tx.proceeds ?? 0), costBasis: Number(tx.cost_basis ?? 0), ... gainLoss: Number(tx.gain_loss ?? 0)` — three independent reads with independent NULL→0 coercion. All three columns are nullable in migration 008 (lines 53-55). Nothing asserts gain_loss === proceeds − cost_basis, so a row with proceeds $10,000 and a NULL basis renders as proceeds $10,000 / basis $0.00 / gain $0.00, and the Part and grand totals sum those inconsistent values independently (buildPart lines 64-67).

**Correct:** Compute column (h) as (d) − (e) + (g) at render time rather than trusting a stored aggregate, and treat a NULL proceeds or NULL basis on a sell row as an incomplete record — exclude it from the totals and surface it to the user rather than silently printing $0.00.

**Harm:** A user sees a $10,000 sale with a $0.00 basis and a $0.00 gain, an impossible combination, and cannot tell which of the three numbers to trust; if the totals are used, a full-proceeds gain is either omitted from income or a zero basis inflates the gain to the entire proceeds.

---

## P2 - app/api/tax/form-8949/route.ts:94
**Statute:** IRC §408(e)(1) — individual retirement accounts are exempt from tax; dispositions inside them are not reported on Form 8949/Schedule D  
**Source:** https://www.law.cornell.edu/uscode/text/26/408

**Issue:** The export has no way to exclude dispositions inside IRAs and other tax-advantaged accounts, because capital_gains carries no account linkage — even though the codebase already has a working retirement-account classifier used elsewhere.

> Any individual retirement account is exempt from taxation under this subtitle unless such account has ceased to be an individual retirement account by reason of paragraph (2) or (3).

**Current:** The query selects every capital_gains sell row for the user and tax year with no account filter. supabase/migrations/008_create_tax_management.sql:40-61 defines capital_gains with no account_id / linked_accounts foreign key, so no such filter is even possible. lib/tax-analysis.ts:192 exports isRetirementAccount() (subtype set plus a name regex covering 401k/IRA/Roth/HSA/529) and applies it to holdings at line 712, but that guard is absent from the Form 8949 path — while app/dashboard/taxes/page.tsx:265 promises the form is built 'across your connected accounts.'

**Correct:** Add an account reference to capital_gains and filter the Form 8949 query through the existing isRetirementAccount() guard, so IRA/401(k)/HSA/529 dispositions never appear on the export; until that column exists, state on the artifact that retirement-account activity cannot be distinguished and must be removed by hand.

**Harm:** Once realized-gain rows are populated from a whole-book Plaid sync that includes the Edward Jones and Schwab retirement accounts these users hold, tax-exempt IRA sales appear on the user's Form 8949 — overstating proceeds and gain, creating tax on income that is not taxable, and generating a 1099-B mismatch with the IRS.

---

## P2 - app/dashboard/taxes/page.tsx:1213
**Statute:** IRC §1222(11); IRC §1(h)(1) (the preferential rate applies only to net capital gain, i.e. net LT gain in excess of net ST loss)  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** The 'Estimated tax · by holding period' card computes long-term and short-term tax from floored gross nets (Math.max(0, ...)) with no cross-character netting, so its dollar figures contradict the netted estimatedTaxDue shown in the footer of the same card.

> Generally, if you hold the asset for more than one year before you dispose of it, your capital gain or loss is long-term. ... The amount of the excess loss that you can claim to lower your income is the lesser of $3,000 ($1,500 if married filing separately) or your total net loss shown on line 16 of Schedule D.

**Current:** HoldingPeriodBars receives longTermNet={Math.max(0, longTermNet)} and shortTermNet={Math.max(0, shortTermNet)} (lines 831-832) and computes ltTax = longTermNet * LTCG_RATE_DEFAULT, stTax = shortTermNet * TAX_RATE. For a user with a $5,000 net short-term loss and a $10,000 net long-term gain, the bar reads '$1,500' of long-term tax and labels it '$10,000 taxed at preferential rate', while the footer of the same card shows the correctly netted estimatedTaxDue of $750. Two different tax numbers for the same year appear inches apart.

**Correct:** Either drive the bars from the same §1222(11)-netted residuals that estimatedTaxDue uses, or keep the gross split but stop labeling the bars in tax dollars — label them as gains by character and show the single netted tax figure once. The current 'taxed at preferential rate' caption asserts a tax treatment for gain that the statute requires to be reduced by the opposite-character loss first.

**Harm:** A user reading the card believes they owe more tax than the app's own netted estimate elsewhere on the same page, and cannot tell which number is the estimate.

---

## P2 - app/dashboard/taxes/page.tsx:1194
**Statute:** IRC §1411 (3.8% net investment income tax on net gain from disposition of property, MAGI thresholds $200,000 single / $250,000 MFJ / $125,000 MFS, not indexed for inflation); IRC §1(h) (0/15/20 rate structure)  
**Source:** https://www.irs.gov/taxtopics/tc559

**Issue:** The only disclaimer a user actually sees misdescribes the rate basis ('a 32% blended tax rate' when the page also applies 15% to long-term) and names none of the material exclusions — NIIT, state tax — while the engine's full DISCLAIMER that does name them is returned by the API and never rendered anywhere.

> A 3.8 percent net investment income tax (NIIT) applies to individuals, estates, and trusts that have net investment income above applicable threshold amounts. ... net gains from the disposition of property such as stocks, bonds, mutual funds, and real estate. ... $250,000 for married filing jointly or qualifying surviving spouse; $125,000 for married filing separately; $200,000 for single or head of household.

**Current:** The page footer reads 'All figures are estimates based on a 32% blended tax rate' — but the page applies LTCG_RATE_DEFAULT (15%) to every long-term figure, so the stated basis does not describe the numbers shown. Nothing on the page mentions §1411 or state tax. Meanwhile lib/tax-analysis.ts:559-568 defines a DISCLAIMER that correctly states 'AMT, NIIT (3.8% surtax), and state-specific rules are not' factored in, and it is returned on the report object — but a repo-wide grep for a consumer of `.disclaimer` finds none, so it is dead. Worse, the two disclosures contradict each other on state tax: lib/financial-config.ts:13 comments TAX_RATE as the 'Combined federal + state SHORT-TERM capital gains / ordinary income rate' while the engine DISCLAIMER tells the user state rules are excluded. A single default rate is defensible as an estimate, but only if the disclosure says what it does and do

**Correct:** Render the engine DISCLAIMER (or its substance) on /dashboard/taxes and fix the sentence to state the actual basis: short-term/ordinary at TAX_RATE and long-term at LTCG_RATE_DEFAULT, federal only, excluding the §1411 3.8% NIIT (which applies above $200k/$250k MAGI and is not inflation-indexed, so it reaches an increasing share of the target user), AMT, and state income tax. Resolve the contradiction in lib/financial-config.ts:13 by deciding whether TAX_RATE is federal-only or fed+state and making both the comment and the disclosure say the same thing.

**Harm:** A user above the §1411 threshold in a taxing state is shown TLH savings and tax-owed figures that can be understated by 15-20 percentage points of rate with no indication of what was left out, and the one disclosure that would have told them is code that never reaches a screen.

---

## P2 - lib/insights-engine.ts:249
**Statute:** IRC §1(h); IRC §1222(11) (the rate follows the character of the gain being absorbed — long-term gain is never taxed at the ordinary rate)  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** The insight sentence attributes the capped TLH savings figure to 'a 32% rate' when the figure was computed with unknown-character losses folded into the long-term pool and valued at 15%, so the stated rate cannot reproduce the stated dollar.

> A capital gains rate of 15% applies if your taxable income is [within the defined ranges] ... However, a capital gains rate of 20% applies to the extent that your taxable income exceeds the thresholds set for the 15% capital gain rate.

**Current:** estimatedSavings comes from estimateCappedTlhSavings({ unknownLoss: totalLoss, ... }), which per its own contract treats unknown-character losses as long-term and absorbs long-term gains at ltcgRate. The string then appends 'that is an estimated $X in offsettable tax at a 32% rate.' For a user with $20,000 of long-term realized gain YTD and $20,000 of unrealized losses, X = $3,000 (20,000 × 0.15), and the sentence reads '$3,000 in offsettable tax at a 32% rate' — 20,000 × 32% is $6,400. The same mislabel appears at app/api/ai/analyze/route.ts:333, 'Estimated tax savings (at 32% rate)', applied to the already-blended totalEstimatedSavings.

**Correct:** Drop the rate claim from the sentence, or report the derived effective rate (cappedSavings ÷ loss applied) rather than TAX_RATE. Under §1(h) there is no scenario in which the ordinary rate applies to the long-term gain that portion of the loss offsets, so naming 32% asserts a rate the statute does not permit for that dollar.

**Harm:** A user who checks the arithmetic finds the stated rate and the stated dollar are irreconcilable, and a user who trusts the rate over the dollar believes the harvest is worth roughly twice what the app actually computed.

---

## P2 - lib/tax-analysis.ts:554
**Statute:** IRC §1(h) (capital gain rates are 0%, 15%, 20%, with 25% unrecaptured §1250 and 28% collectibles — no 23.5% rate exists); IRC §1222  
**Source:** https://www.irs.gov/taxtopics/tc409

**Issue:** calculateSavings values an unknown-holding-period loss at (32% + 15%)/2 = 23.5%, a rate with no basis in §1(h), labeled 'Conservative blend' when it is neither conservative nor consistent with the netted estimator in the same file.

> A capital gains rate of 0% applies if your taxable income is less than or equal to [the specified thresholds]; A capital gains rate of 15% applies if your taxable income is [within the defined ranges]; However, a capital gains rate of 20% applies to the extent that your taxable income exceeds the thresholds set for the 15% capital gain rate.

**Current:** effectiveRate = (stcgRate + ltcgRate) / 2 for holdingPeriod === 'unknown', producing 23.5% and a per-position estimatedSavings rendered to the user at app/dashboard/taxes/page.tsx:1419 and :1641. estimateCappedTlhSavings in the same file (line 622) deliberately does the opposite — it folds unknownLoss into the long-term pool precisely because that 'errs conservative'. The result is that the same loss dollar with an unknown acquisition date is valued at 23.5% in the position row and at 15% in the headline total, and because Plaid frequently returns no acquired_at, 'unknown' is the common case, not the edge case.

**Correct:** Use the long-term rate for unknown-character losses so the row-level number matches the headline estimator's stated convention, and correct the comment: the conservative choice is the lower LTCG rate, not the midpoint. If a midpoint is kept deliberately, the row must not be presented as a rate-derived tax figure, because no §1(h) rate equals it.

**Harm:** Position-level 'estimated savings' figures do not sum to the headline savings the same page shows, and the per-row number is derived from a capital gains rate that does not exist in the Code.

---

