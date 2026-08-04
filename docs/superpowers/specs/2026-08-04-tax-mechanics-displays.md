# Tax mechanics, made visible

Written 2026-08-04, after the §1211(b) correction dropped a headline TLH figure from $67,237 to $960.

## The problem

Tax law's mechanics are counterintuitive, and a bare number hides them. A user who sees **"$960 estimated savings"** on a book with **$305,427 of harvestable losses** concludes the feature is worthless — when the truth is that the other $302,427 is *banked*, offsets future gains without limit, and is one realized gain away from being worth six figures. The number is right; the *story* is missing.

Every intricacy below is a place where showing the mechanism converts a confusing figure into a decision the user can act on. This is also the product's differentiator: an advisor tells you what to do, Helm shows you the machinery.

## 1. The harvest ladder (highest value — build first)

Replaces the single "estimated savings" figure on `/dashboard/taxes` with the four-step waterfall the statute actually runs:

```
Harvestable losses found                          $305,427   13 positions
  ├─ offsets realized gains this year (no limit)        $0   ← you have none yet
  ├─ deducts against ordinary income (annual cap)   $3,000   → $960 at your 32% rate
  └─ carries forward to future years              $302,427   never expires
```

Reading rules: the gain-offset row is **uncapped** and must be visually the widest lever; the cap row shows the statutory annual limit; the carryforward row is the punchline, not a footnote. When the user *does* have realized gains, the first row fills and the headline number jumps — that transition is the feature teaching itself.

Copy discipline: "estimated", "at your assumed rate", never "you will save".

## 2. Wash-sale window calendar

Per flagged position, a 61-day strip centered on the sale date: 30 days before, the sale, 30 days after, with buys plotted on it. States: clear (no buys in window), tripped (a buy lands inside → the loss is **disallowed and added to basis**, not lost — say that explicitly, it is the single most misunderstood rule), and blocked-until (the date after which a repurchase is safe).

Must also surface the trap civilians never know: a replacement purchase inside an **IRA or 401(k)** disallows the loss **permanently** with no basis restoration (Rev. Rul. 2008-5) — and automatic dividend reinvestment counts as a purchase.

## 3. Holding-period clock

For every position at a loss or gain, days until it crosses from short-term to long-term, and the dollar consequence of waiting:

- On a **gain**: "22 days to long-term — the rate on this position drops from 32% to 15%, worth ~$X on the current unrealized gain."
- On a **loss**: the inverse — a short-term loss is *more* valuable against short-term gains, so waiting can cost.

This is the single most actionable tax display in the product and no competitor shows it. It states arithmetic, never a recommendation.

## 4. Carryforward bank

A persistent line on the taxes page: losses banked from prior years plus what this year's harvest would add, with the character split preserved (short-term and long-term carry forward separately and keep their character). Answers "what is my harvesting actually buying me over time" — and it is the number that compounds with the graded record.

## 5. Netting order

A small two-column visual (short-term / long-term) showing losses offsetting same-character gains first, then crossing over. Explains why two users with identical losses get different savings — the thing that makes the headline number feel arbitrary until you see it.

## Sequencing

1. Harvest ladder — fixes the "$960 looks worthless" problem the correction created.
2. Holding-period clock — highest actionability per pixel.
3. Wash-sale calendar — highest harm avoided.
4. Carryforward bank, then netting order.

## Non-negotiables

- Every figure labeled an estimate, with its rate assumption stated inline.
- State tax and the 3.8% NIIT are excluded — say so where a number appears, not only in a footer.
- Describe mechanics; never instruct. "Selling before Sep 3 would disallow the loss" is fine; "wait until Sep 3 to sell" is not.
- Any figure shown here must come from `lib/tax-analysis.ts` (`estimateCappedTlhSavings` and friends) — never a second implementation. The $67,237 error existed because `lib/research/account.ts` grew its own flat-rate math.
