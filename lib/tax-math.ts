// Pure Schedule D math. Deliberately free of any Supabase/next import so client
// components can share the same formulas as the server engine — the Tax Center
// is a client component, and a second implementation is how the same user ended
// up seeing two different "estimated tax" numbers on one screen.

import { TAX_RATE, LTCG_RATE_DEFAULT, ANNUAL_LOSS_DEDUCTION_CAP } from '@/lib/financial-config';

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
  const deductibleThisYear = Math.min(netLoss, ANNUAL_LOSS_DEDUCTION_CAP);
  savings += deductibleThisYear * ord;

  return {
    savings,
    gainsOffset,
    deductibleThisYear,
    carryforward: Math.max(0, netLoss - ANNUAL_LOSS_DEDUCTION_CAP),
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
}): CappedTlhResult {
  const ord = params.ordinaryRate ?? TAX_RATE;
  const ltcg = params.ltcgRate ?? LTCG_RATE_DEFAULT;

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
  );
  const baseline = runNetting(
    realizedStLoss,
    realizedLtLoss,
    params.stGainYtd,
    params.ltGainYtd,
    ord,
    ltcg,
  );

  return {
    cappedSavings: Math.max(0, total.savings - baseline.savings),
    totalPositionSavings: total.savings,
    baselineSavings: baseline.savings,
    deductibleThisYear: total.deductibleThisYear,
    estimatedCarryforward: total.carryforward,
    remainingDeductibleLoss: Math.max(0, ANNUAL_LOSS_DEDUCTION_CAP - total.deductibleThisYear),
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
