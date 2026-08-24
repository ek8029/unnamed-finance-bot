# The Rule of 16 — research + where it fits in Helm

> Research date: Aug 23, 2026. VIX spot 15.13 (Cboe, Aug 21 close), 52-week range 13.38–35.30.
> Status: research + lab mockups. Nothing shipped.

## 1. What the rule is

VIX is the market's expectation of S&P 500 volatility over the next 30 days, quoted as an
**annualized** standard deviation in percent. Annualized is the problem: nobody experiences a year
at a time. The rule of 16 converts it to the number you actually feel — the expected **daily** move.

Volatility scales with the square root of time. A year has ~252 trading days, and

```
√252 = 15.87 ≈ 16
```

so:

```
expected 1-day move (1σ) ≈ VIX / 16
```

| VIX | Implied 1σ daily move | Reading |
|-----|----------------------|---------|
| 12  | ±0.75%               | calm    |
| 16  | ±1.0%                | the baseline — one point of VIX per 1% of daily move |
| 15.13 (now) | ±0.95%       | slightly below the 1%-a-day line |
| 24  | ±1.5%                | elevated |
| 32  | ±2.0%                | stressed |
| 48  | ±3.0%                | crisis (COVID March 2020 printed 82 ≈ ±5.1%/day) |

### The 1σ meaning — this is the part everyone drops

VIX/16 is **one standard deviation**, not a ceiling. Under the (rough) normality assumption:

- ~68% of days should close inside ±VIX/16
- ~32% of days — **1 day in 3** — should close *outside* it
- ~5% of days beyond ±2×(VIX/16)

So the honest phrasing is a **band**, not a prediction: "options are pricing about two days in
three inside ±1.0%." If every single day lands inside the band, vol was overpriced, not "right."

### Other horizons (same math, different divisor)

| Horizon | Divisor | At VIX 16 |
|---------|---------|-----------|
| Day     | √252 ≈ 16   | ±1.0%  |
| Week    | √52 ≈ 7.2   | ±2.2%  |
| Month   | √12 ≈ 3.5   | ±4.6%  |

### It runs both ways

Divide to go from annual to daily; multiply to go from daily to annual. If the S&P is swinging
2% a day, realized vol is running ~32 annualized — so a VIX of 24 against that tape is *cheap*,
not expensive. The rule is how traders compare what options **charge** (VIX) with what the tape
**delivers** (realized), in the same units.

## 2. Caveats — what the number is not

1. **Implied, not predicted.** VIX is the risk-neutral expectation embedded in SPX option
   prices — what hedging costs, not a forecast. Historically it has tended to sit *above*
   subsequently realized volatility most of the time (the variance risk premium — sellers of
   insurance get paid). So the band is usually a touch generous.
2. **One sigma only.** 1 day in 3 lands outside. Never present the band as a limit.
3. **√252 vs the 16 shortcut.** 16 overshoots √252 by ~0.8%. Irrelevant at our precision.
   (Purists also note VIX uses 30 *calendar* days while the rule divides by *trading* days —
   the conventions offset closely enough that the whole industry shrugs.)
4. **Normality is a lie at the tails.** Real returns are fat-tailed; ±3σ days happen far more
   often than a Gaussian says. The band is a ruler for ordinary days, not a model of crashes.
5. **It's the S&P's band, not yours.** A concentrated tech book runs hotter than SPX. The rule
   gives the *market's* normal day; a portfolio's own band needs its own vol (beta or realized).
   That distinction is exactly what makes it useful copy: "the market priced a ±0.9% day;
   your book moved 1.8%" is a real sentence about concentration.

## 3. Why this fits Helm specifically

Helm's design thesis, verbatim from the product: *"Every figure sits on a scale. Your day change
sits on a band of what a normal day looks like."* The existing "normal day" band is **backward-
looking** (your own history). The rule of 16 gives the matching **forward-looking** band — what
the options market says a normal day should look like *today* — from one number Helm can already
see, with arithmetic a user can check on a napkin. That last part matters: Helm's moat language is
"not advice, arithmetic," and VIX/16 is the most famous piece of trading arithmetic there is.

It also converts VIX from noise to signal for the ICP. Retail sees "VIX 24 ↑12%" and knows it's
"fear." VIX/16 turns it into a sentence about *their Tuesday*: "options price a ±1.5% day."

## 4. Placement (recommendation)

The brief is right — but it lands in four spots, in this ship order:

1. **The market strip cell** (`app/dashboard/brief/page.tsx:433`). Today the cell prints the
   VIXY dollar price under the label "VIX" and classifies it with VIX-index thresholds — two
   unrelated scales. Replace with the real index and a `±0.95% priced day` subline. This is a
   bug fix and the feature in one change.
2. **The sentence** — in `generalMarketBrief` (`page.tsx:405-425`) and, higher-leverage, in the
   digest prompt: `lib/generate-digest.ts:82` currently hands GPT-4o-mini `VIX proxy (VIXY): $…`.
   Hand it the *computed* sentence ("VIX 15.1 — options price a ±0.95% S&P day") so the model
   narrates arithmetic it cannot get wrong.
3. **The band module** — what was priced vs what happened, one scale. Web: new module in the
   brief. Mobile: the `Bearing` primitive already draws the day change on a ±2% scale
   (hardcoded, triplicated); overlay the priced band as a gold-wash region and the comparison
   is free. "Your +1.4% sits outside the ±0.95% the market priced" is the most Helm sentence
   the rule can produce — it turns VIX into a statement about *your* concentration.
4. **Public `/brief` "Day at a glance"** (`app/brief/public-brief.tsx:387`) — priced move +
   realized + verdict. No auth, 5-min revalidate. GEO: "what daily move did the options market
   price today" answered in checkable arithmetic is quotable material.

**Rejected placements:** watchlist alerts (VIXY's price level cannot produce a band — only the
real index can); per-ticker expected moves (needs per-name options IV; no licensed vendor).

## 6. Lab mockups

- Web: `/testing/vix16` (registered in the design-lab index)
- Mobile: helm-mobile `http://localhost:8082/?lab=vix` (`components/lab-vix16.tsx`)

## 5. Codebase reality

- **Helm cannot fetch the VIX index today.** Finazon `us_stocks_essential` is equities/ETFs
  only; every "VIX" in the product is actually VIXY. The route is honest about it
  (`app/api/dashboard/brief/route.ts:23-31`, thresholds calibrated for VIXY) — the UI is not
  (`page.tsx:413-416` and `:433` print the VIXY price as a VIX level with VIX thresholds).
- **Free fix, verified live Aug 23:** Cboe's delayed-quote JSON at
  `https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json` returns the real index —
  current 15.13, prev close, OHLC, change — no key, 15-min delay. A `lib/vix.ts` with a
  5–10 min cache covers the brief (generated 9:15 ET, where the prior close is the right
  input anyway) and every surface above.
- **The digest's market inputs are thin:** `lib/generate-digest.ts:55-56` fetches exactly two
  quotes, SPY and VIXY. The read API is much richer (`app/api/dashboard/brief/route.ts:161-191`
  pulls SPY/QQQ/VIXY/TLT).
- **Mobile already has the band primitive:** `Bearing`
  (helm-mobile `components/screens/instrument.tsx:184`) — needle on a symmetric range with
  overflow markers. The range is a magic `2` duplicated in three screens
  (`brief-instrument.tsx:23`, `overview-instrument.tsx:30`, `portfolio-instrument.tsx:36`);
  lift it before adding a fourth consumer.
- **The portfolio's own band is computed and thrown away:** `lib/market-sync.ts:425` derives
  `dailyVol` from reconstructed daily portfolio values, then persists only the annualized
  figure (`:508`). Persist `dailyVol` and "your usual day is ±1.2%" is a database read —
  no new data source.
- **Prior art for per-instrument normal-day thresholds:** `lib/watchlist-defaults.ts:17-35`
  (VIXY clears 3% on quiet days; hand-tuned thresholds exist precisely because one band does
  not fit all instruments).
