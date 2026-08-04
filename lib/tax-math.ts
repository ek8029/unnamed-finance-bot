// Pure Schedule D math. Deliberately free of any Supabase/next import so client
// components can share the same formulas as the server engine — the Tax Center
// is a client component, and a second implementation is how the same user ended
// up seeing two different "estimated tax" numbers on one screen.

import { TAX_RATE, LTCG_RATE_DEFAULT, ANNUAL_LOSS_DEDUCTION_CAP } from '@/lib/financial-config';

// ── Per-user tax profile ──

export interface TaxProfile {
  /** Ordinary / short-term rate. */
  ordinaryRate: number;
  /** IRC §1(h) long-term rate. */
  ltcgRate: number;
  /** IRC §1211(b) annual ordinary-income deduction limit. */
  annualLossCap: number;
  filingStatus: string | null;
  /** True when the rates came from the user's own settings rather than defaults. */
  fromSettings: boolean;
}

/** IRC §1211(b)(1): "$3,000 ($1,500 in the case of a married individual filing
 *  a separate return)". Settings collects filing status; this applies it. */
export function annualLossCapFor(filingStatus: string | null | undefined): number {
  const f = (filingStatus ?? '').trim().toLowerCase();
  if (f === 'married filing separately' || f === 'mfs') return ANNUAL_LOSS_DEDUCTION_CAP / 2;
  return ANNUAL_LOSS_DEDUCTION_CAP;
}

/**
 * Resolve rates and the §1211(b) cap from what the user told us in settings.
 *
 * The long-term rate is DERIVED from the ordinary bracket, not stored: IRC §1(h)
 * ties the 0/15/20 bands to taxable income, and the ordinary bracket is the only
 * income signal Helm has. The mapping is the standard approximation (0% within
 * the 10/12% brackets, 20% at 37%, 15% between) and is disclosed as an estimate.
 */
export function resolveTaxProfile(
  prefs: { filing_status?: string | null; tax_bracket?: string | null } | null,
): TaxProfile {
  const filingStatus = prefs?.filing_status ?? null;
  const annualLossCap = annualLossCapFor(filingStatus);

  const bracketRaw = (prefs?.tax_bracket ?? '').replace('%', '').trim();
  const bracket = bracketRaw ? Number(bracketRaw) / 100 : NaN;
  if (!Number.isFinite(bracket) || bracket <= 0 || bracket > 0.5) {
    return {
      ordinaryRate: TAX_RATE,
      ltcgRate: LTCG_RATE_DEFAULT,
      annualLossCap,
      filingStatus,
      fromSettings: false,
    };
  }

  const ltcgRate = bracket <= 0.12 ? 0 : bracket >= 0.37 ? 0.20 : 0.15;
  return { ordinaryRate: bracket, ltcgRate, annualLossCap, filingStatus, fromSettings: true };
}

export interface CappedTlhResult {
  /** MARGINAL current-year benefit of the proposed harvest: the whole-position
   *  figure minus the baseline the user already has from losses realized YTD.
   *  §1211(b) is a per-return annual limit, so a deduction another loss already
   *  consumed is not caused by this harvest. */
  cappedSavings: number;
  /** Current-year benefit of the user's whole capital-loss position: losses
   *  already realized this year plus the proposed harvest. */
  totalPositionSavings: number;
  /** What the user already has this year without harvesting anything more. */
  baselineSavings: number;
  deductibleThisYear: number;
  estimatedCarryforward: number;
  remainingDeductibleLoss: number;
  /** IRC §1211(b) waterfall, harvest scenario — the harvest-ladder display.
   *  Loss absorbed by realized capital gains (uncapped under §1211(b)). */
  gainsOffset: number;
  /** Loss deducted against ordinary income, i.e. deductibleThisYear. */
  ordinaryIncomeOffset: number;
  /** Loss carried to future years under §1212(b). */
  carryforward: number;
}

interface NettedScenario {
  savings: number;
  gainsOffset: number;
  deductibleThisYear: number;
  carryforward: number;
}

/** One pass of the Schedule D waterfall over a given set of loss pools. */
function runNetting(
  stLossIn: number,
  ltLossIn: number,
  stGainYtd: number,
  ltGainYtd: number,
  ord: number,
  ltcg: number,
  annualCap: number,
): NettedScenario {
  let stLoss = stLossIn;
  let ltLoss = ltLossIn;
  let stGain = Math.max(0, stGainYtd);
  let ltGain = Math.max(0, ltGainYtd);
  let savings = 0;
  let gainsOffset = 0;

  // 1. Same-character netting.
  const stSame = Math.min(stLoss, stGain);
  savings += stSame * ord;
  gainsOffset += stSame;
  stLoss -= stSame;
  stGain -= stSame;

  const ltSame = Math.min(ltLoss, ltGain);
  savings += ltSame * ltcg;
  gainsOffset += ltSame;
  ltLoss -= ltSame;
  ltGain -= ltSame;

  // 2. Cross-netting — valued at the absorbed gain's rate.
  const stIntoLt = Math.min(stLoss, ltGain);
  savings += stIntoLt * ltcg;
  gainsOffset += stIntoLt;
  stLoss -= stIntoLt;
  ltGain -= stIntoLt;

  const ltIntoSt = Math.min(ltLoss, stGain);
  savings += ltIntoSt * ord;
  gainsOffset += ltIntoSt;
  ltLoss -= ltIntoSt;
  stGain -= ltIntoSt;

  // 3. Net capital loss → $3,000 ordinary-income deduction; excess carries
  //    forward (ST consumed first — affects carryforward character only,
  //    which this dollar estimate does not need to split).
  const netLoss = stLoss + ltLoss;
  const deductibleThisYear = Math.min(netLoss, annualCap);
  savings += deductibleThisYear * ord;

  return {
    savings,
    gainsOffset,
    deductibleThisYear,
    carryforward: Math.max(0, netLoss - annualCap),
  };
}

/**
 * Schedule D netting (IRC §1222; §1211(b); §1212(b)), verified against the
 * 2025 Schedule D instructions and Pub 550:
 *   1. Same-character netting: ST losses vs ST gains, LT losses vs LT gains.
 *   2. Cross-netting is mechanical; the savings RATE follows the GAIN being
 *      absorbed, not the loss's character (§1222(11): the preferential rate
 *      applies only to net LT gain in excess of net ST loss). An ST loss
 *      absorbing LT gain saves at the LTCG rate; an LT loss absorbing ST gain
 *      saves at the ordinary rate.
 *   3. Remaining net loss deducts up to $3,000 against ordinary income at the
 *      ordinary rate; the excess carries forward (ST consumed first by the
 *      deduction per the Capital Loss Carryover Worksheet).
 * Losses with unknown holding period are folded into the LT pool: LT losses
 * reach the low-rate absorption first, so the estimate errs conservative.
 * NIIT (3.8%) and state rates are deliberately excluded (see DISCLAIMER).
 * Wash-sale-flagged lots must be excluded by the caller (§1091: deferred, not
 * saved this year).
 */
export function estimateCappedTlhSavings(params: {
  /** Harvestable losses by character (sign-insensitive). Unknown → conservative LT treatment. */
  stLoss?: number;
  ltLoss?: number;
  unknownLoss?: number;
  /** YTD net realized by character; negative = already-realized net losses. */
  stGainYtd: number;
  ltGainYtd: number;
  ordinaryRate?: number;
  ltcgRate?: number;
  /** IRC §1211(b) limit for THIS user. $1,500 when married filing separately. */
  annualCap?: number;
}): CappedTlhResult {
  const ord = params.ordinaryRate ?? TAX_RATE;
  const ltcg = params.ltcgRate ?? LTCG_RATE_DEFAULT;
  const annualCap = params.annualCap ?? ANNUAL_LOSS_DEDUCTION_CAP;

  // Already-realized YTD net losses belong in the netting — they legitimately
  // consume the §1211(b) cap and change the marginal answer — but they are NOT
  // savings the proposed harvest produces. Run the waterfall twice and report
  // the difference, or a user who already harvested this year is told a fresh
  // sale saves $960 when it saves nothing more this year.
  const realizedStLoss = Math.max(0, -params.stGainYtd);
  const realizedLtLoss = Math.max(0, -params.ltGainYtd);
  const harvestStLoss = Math.abs(params.stLoss ?? 0);
  // Unknown-character losses fold into LT: LT reaches the low-rate absorption
  // first, so the estimate errs conservative.
  const harvestLtLoss = Math.abs(params.ltLoss ?? 0) + Math.abs(params.unknownLoss ?? 0);

  const total = runNetting(
    realizedStLoss + harvestStLoss,
    realizedLtLoss + harvestLtLoss,
    params.stGainYtd,
    params.ltGainYtd,
    ord,
    ltcg,
    annualCap,
  );
  const baseline = runNetting(
    realizedStLoss,
    realizedLtLoss,
    params.stGainYtd,
    params.ltGainYtd,
    ord,
    ltcg,
    annualCap,
  );

  return {
    cappedSavings: Math.max(0, total.savings - baseline.savings),
    totalPositionSavings: total.savings,
    baselineSavings: baseline.savings,
    deductibleThisYear: total.deductibleThisYear,
    estimatedCarryforward: total.carryforward,
    remainingDeductibleLoss: Math.max(0, annualCap - total.deductibleThisYear),
    gainsOffset: total.gainsOffset,
    ordinaryIncomeOffset: total.deductibleThisYear,
    carryforward: total.carryforward,
  };
}

/**
 * Estimated federal tax on realized capital gains after IRC §1222(11) netting.
 *
 * Short-term losses offset short-term gains and long-term losses offset
 * long-term gains first; only then do they cross over. The §1(h) preferential
 * rate reaches only the residual NET LONG-TERM gain in excess of net short-term
 * loss, so applying a single "blended" ordinary rate to a long-term-heavy book
 * can more than double the estimate, and flooring each character at zero
 * independently ignores the offset entirely.
 *
 * Federal only. Excludes the §1411 3.8% NIIT, AMT, and state tax.
 */
export function estimateTaxOnRealizedGains(params: {
  /** Net realized short-term (gains + losses), signed. */
  stNet: number;
  /** Net realized long-term (gains + losses), signed. */
  ltNet: number;
  ordinaryRate?: number;
  ltcgRate?: number;
}): number {
  const ord = params.ordinaryRate ?? TAX_RATE;
  const ltcg = params.ltcgRate ?? LTCG_RATE_DEFAULT;
  const { stNet, ltNet } = params;
  if (stNet + ltNet <= 0) return 0;
  if (stNet >= 0 && ltNet >= 0) return stNet * ord + ltNet * ltcg;
  // One character is a net loss; it absorbs the other before any rate applies.
  const combined = stNet + ltNet;
  return stNet > 0 ? combined * ord : combined * ltcg;
}

/**
 * Determine holding period from acquired_at, on the IRS anniversary rule.
 *
 * Per the Form 8949 instructions and Topic No. 409: "count from the day AFTER
 * the day you acquired the asset up to and including the day you disposed of
 * it", and long-term requires MORE than one year (IRC §1222(3)). So a position
 * is long-term only once the evaluation date is strictly after the one-year
 * anniversary — on the anniversary itself it is still short-term.
 *
 * Elapsed-day arithmetic (diffDays > 365) got this wrong twice: it flipped to
 * long-term at noon on the anniversary in a non-leap window, and a full day
 * early across a leap year, which made the badge time-of-day dependent.
 * Compare date-only values so the clock cannot move the answer.
 */
export function classifyHoldingPeriod(acquiredAt: string | null): 'short_term' | 'long_term' | 'unknown' {
  if (!acquiredAt) return 'unknown';
  try {
    const acquired = new Date(acquiredAt + 'T00:00:00Z');
    if (Number.isNaN(acquired.getTime())) return 'unknown';
    // Long-term begins the day AFTER the one-year anniversary.
    const longTermFrom = new Date(Date.UTC(
      acquired.getUTCFullYear() + 1,
      acquired.getUTCMonth(),
      acquired.getUTCDate() + 1,
    ));
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return todayUtc >= longTermFrom.getTime() ? 'long_term' : 'short_term';
  } catch {
    return 'unknown';
  }
}

export type HoldingPeriod = 'short_term' | 'long_term' | 'unknown';

export interface LossCharacterSplit {
  stLoss: number;
  ltLoss: number;
  unknownLoss: number;
  total: number;
}

/**
 * Split harvestable losses by IRC §1222 holding period.
 *
 * Which character a loss carries decides which gain it absorbs and therefore the
 * rate at which it saves tax (§1222(11)). Four surfaces used to dump every
 * dollar into `unknownLoss`, which the estimator pools with long-term, so the
 * Actions Inbox, the brief, and the chat could show half what the Tax Center
 * showed for the same harvest on the same day.
 */
export function splitLossByCharacter(
  rows: { loss: number; acquiredAt: string | null }[],
): LossCharacterSplit {
  const out: LossCharacterSplit = { stLoss: 0, ltLoss: 0, unknownLoss: 0, total: 0 };
  for (const r of rows) {
    const l = Math.abs(r.loss);
    if (l === 0) continue;
    out.total += l;
    const period = classifyHoldingPeriod(r.acquiredAt);
    if (period === 'short_term') out.stLoss += l;
    else if (period === 'long_term') out.ltLoss += l;
    else out.unknownLoss += l;
  }
  return out;
}
