// Service-role account reads for the research engine. The shipped
// getPortfolioSummary / generateTaxReport are bound to the request session
// (createClient with cookies), so they cannot serve an arbitrary account under a
// service client — the /testing surface and any cron-style caller need these
// self-contained equivalents. All reads are user-scoped and best-effort.

import type { SupabaseClient } from '@supabase/supabase-js';
import { TAX_RATE, LTCG_RATE_DEFAULT } from '@/lib/financial-config';
import { isRetirementAccount } from '@/lib/tax-analysis';
import {
  estimateCappedTlhSavings,
  estimateTaxOnRealizedGains,
  splitLossByCharacter,
  type LossCharacterSplit,
} from '@/lib/tax-math';

export interface BriefHolding {
  ticker: string;
  value: number;
  pct: number;
  unrealizedGainLoss: number | null;
  costBasis: number | null;
  sector: string | null;
  /** Account names this position spans (multi-brokerage books hold one name in 2+). */
  accounts: string[];
  /** Today's move, percent. DB stores a decimal fraction; this is x100 so it
   *  matches every other percentage in the research context. Null when the
   *  position has no price feed. */
  dayChangePct: number | null;
  /** Unrealized gain/loss from TAXABLE accounts only. A loss inside an IRA,
   *  401(k), HSA or 529 produces no current deduction (IRC §408(e)(1)), so it
   *  must never enter a harvestable total. Null when no taxable row was priced. */
  taxableUnrealizedGainLoss: number | null;
}

export interface PortfolioBrief {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealized: number;
  positionCount: number;
  /** Harvestable dollars split by IRC §1222 holding period, computed per LOT
   *  before the by-ticker fold — one name can sit in two accounts with two
   *  acquisition dates, and character decides the rate the loss saves at. */
  harvestableLoss: LossCharacterSplit;
  holdings: BriefHolding[]; // full book, richest first
  sectorAllocation: { sector: string; pct: number }[];
}

export async function getPortfolioBrief(
  db: SupabaseClient,
  userId: string,
): Promise<PortfolioBrief | null> {
  try {
    // securities join gives sector; degrade to null sector if the relation
    // doesn't resolve.
    const { data, error } = await db
      .from('holdings')
      .select(
        'ticker, total_value, unrealised_gain_loss, total_cost_basis, portfolio_allocation_pct, acquired_at, day_change_pct, securities(sector), linked_accounts(account_name, account_subtype)',
      )
      .eq('user_id', userId)
      .order('total_value', { ascending: false });
    if (error || !data || data.length === 0) return null;

    const totalValue = data.reduce((s, h) => s + Number(h.total_value ?? 0), 0);
    // Fold per-account rows into one line per ticker — a multi-brokerage user
    // (the ICP) holds the same name in 2+ accounts, and unfolded rows both
    // duplicate the ticker in the model's context and understate single-name
    // concentration (the standing check reads the top row's pct).
    const byTicker = new Map<string, BriefHolding>();
    const harvestLots: { loss: number; acquiredAt: string | null }[] = [];
    for (const h of data) {
      const sec = h.securities as { sector?: string | null } | { sector?: string | null }[] | null;
      const sector = Array.isArray(sec) ? (sec[0]?.sector ?? null) : (sec?.sector ?? null);
      type AccRel = { account_name?: string | null; account_subtype?: string | null };
      const acc = h.linked_accounts as AccRel | AccRel[] | null;
      const accRow = Array.isArray(acc) ? (acc[0] ?? null) : acc;
      const accountName = accRow?.account_name ?? null;
      const retirement = isRetirementAccount(accRow?.account_subtype ?? null, accountName);
      const ticker = String(h.ticker).toUpperCase();
      const value = Number(h.total_value ?? 0);
      const gain = h.unrealised_gain_loss != null ? Number(h.unrealised_gain_loss) : null;
      const basis = h.total_cost_basis != null ? Number(h.total_cost_basis) : null;
      // day_change_pct is a DECIMAL FRACTION in the DB (0.0124 = 1.24%).
      const dayPct = h.day_change_pct != null ? Number(h.day_change_pct) * 100 : null;
      const taxableGain = retirement ? null : gain;
      if (taxableGain != null && taxableGain < 0 && value > 0) {
        harvestLots.push({
          loss: Math.abs(taxableGain),
          acquiredAt: h.acquired_at == null ? null : String(h.acquired_at),
        });
      }
      const prev = byTicker.get(ticker);
      if (!prev) {
        byTicker.set(ticker, {
          ticker,
          value,
          pct: 0,
          unrealizedGainLoss: gain,
          costBasis: basis,
          sector,
          accounts: accountName ? [accountName] : [],
          taxableUnrealizedGainLoss: taxableGain,
          dayChangePct: dayPct,
        });
      } else {
        prev.value += value;
        prev.unrealizedGainLoss =
          gain != null ? (prev.unrealizedGainLoss ?? 0) + gain : prev.unrealizedGainLoss;
        prev.taxableUnrealizedGainLoss =
          taxableGain != null
            ? (prev.taxableUnrealizedGainLoss ?? 0) + taxableGain
            : prev.taxableUnrealizedGainLoss;
        prev.costBasis = basis != null ? (prev.costBasis ?? 0) + basis : prev.costBasis;
        prev.sector = prev.sector ?? sector;
        // Same security in two accounts moves the same percent; take whichever
        // lot has a price feed.
        prev.dayChangePct = prev.dayChangePct ?? dayPct;
        if (accountName && !prev.accounts.includes(accountName)) prev.accounts.push(accountName);
      }
    }
    const holdings: BriefHolding[] = [...byTicker.values()]
      .map((h) => ({ ...h, pct: totalValue > 0 ? (h.value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    const totalCostBasis = holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0);
    const totalUnrealized = holdings.reduce((s, h) => s + (h.unrealizedGainLoss ?? 0), 0);

    const sectorMap = new Map<string, number>();
    for (const h of holdings) {
      const key = h.sector ?? 'Unclassified';
      sectorMap.set(key, (sectorMap.get(key) ?? 0) + h.value);
    }
    const sectorAllocation = [...sectorMap.entries()]
      .map(([sector, val]) => ({ sector, pct: totalValue > 0 ? (val / totalValue) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);

    return {
      totalValue,
      totalCostBasis,
      totalUnrealized,
      positionCount: holdings.length,
      harvestableLoss: splitLossByCharacter(harvestLots),
      holdings,
      sectorAllocation,
    };
  } catch {
    return null;
  }
}

// ── Tax context (realized gains YTD + harvestable losses), service-safe ──

interface CapGainRow {
  ticker: string;
  transaction_type: string;
  gain_loss: number;
  gain_loss_type: string;
}

export async function getTaxContext(
  db: SupabaseClient,
  userId: string,
  brief: PortfolioBrief | null,
  year: number,
): Promise<string> {
  const lines: string[] = [];

  // YTD realized by character — needed BELOW for the harvestable estimate too,
  // so it must outlive the try block (harvested losses offset realized gains
  // without limit before IRC 1211(b)'s ordinary-income cap applies).
  let stYtd = 0;
  let ltYtd = 0;

  // Realized, from capital_gains.
  try {
    const { data } = await db
      .from('capital_gains')
      .select('ticker, transaction_type, gain_loss, gain_loss_type')
      .eq('user_id', userId)
      .eq('tax_year', year);
    const sells = ((data ?? []) as CapGainRow[]).filter((g) => g.transaction_type === 'sell');
    if (sells.length > 0) {
      const st = sells.filter((g) => g.gain_loss_type === 'short_term').reduce((s, g) => s + Number(g.gain_loss), 0);
      const lt = sells.filter((g) => g.gain_loss_type === 'long_term').reduce((s, g) => s + Number(g.gain_loss), 0);
      stYtd = st;
      ltYtd = lt;
      const net = st + lt;
      lines.push(
        `=== REALIZED CAPITAL GAINS (${year} YTD) ===`,
        `Short-term net: ${st >= 0 ? '+' : ''}$${Math.round(st).toLocaleString()}`,
        `Long-term net: ${lt >= 0 ? '+' : ''}$${Math.round(lt).toLocaleString()}`,
        `Net realized: ${net >= 0 ? '+' : ''}$${Math.round(net).toLocaleString()}`,
        // Character matters, and so does netting: IRC §1222(11) requires ST and
        // LT to offset each other BEFORE a rate applies. Flooring each side at
        // zero independently told a user with a $10k ST loss and a $20k LT gain
        // they owed tax on the full gain.
        `Estimated tax on realized gains: $${Math.round(
          estimateTaxOnRealizedGains({ stNet: st, ltNet: lt }),
        ).toLocaleString()} (short-term at ${Math.round(TAX_RATE * 100)}%, long-term at ${Math.round(LTCG_RATE_DEFAULT * 100)}%, after §1222(11) netting; federal only, excludes the §1411 NIIT and state tax)`,
      );
    }
  } catch {
    /* no capital_gains — skip realized */
  }

  // Harvestable, from current unrealized losses.
  if (brief) {
    const losers = brief.holdings.filter((h) => (h.taxableUnrealizedGainLoss ?? 0) < 0);
    if (losers.length > 0) {
      const totalLoss = brief.harvestableLoss.total;
      const capped = estimateCappedTlhSavings({
        stLoss: brief.harvestableLoss.stLoss,
        ltLoss: brief.harvestableLoss.ltLoss,
        unknownLoss: brief.harvestableLoss.unknownLoss,
        stGainYtd: stYtd,
        ltGainYtd: ltYtd,
      });
      lines.push(
        '',
        '=== HARVESTABLE LOSSES (unrealized, TAXABLE accounts only) ===',
        `Total harvestable loss: $${Math.round(totalLoss).toLocaleString()} across ${losers.length} positions`,
        // IRC §1211(b): losses offset capital gains without limit, but only
        // $3,000 of net loss deducts against ordinary income per year — a flat
        // rate × total loss overstates year-one savings, sometimes by a lot.
        `Estimated tax savings if realized this year: $${Math.round(capped.cappedSavings).toLocaleString()}`,
        capped.estimatedCarryforward > 0
          ? `Carries forward to future years: $${Math.round(capped.estimatedCarryforward).toLocaleString()} (IRC §1212(b), never expires)`
          : 'Nothing carries forward at this loss level — the losses are absorbed this year.',
        ...losers
          .slice(0, 8)
          .map((h) => `  ${h.ticker}: unrealized -$${Math.round(Math.abs(h.taxableUnrealizedGainLoss ?? 0)).toLocaleString()}`),
        `Note: estimate. Losses first offset realized capital gains dollar-for-dollar (IRC §1211(b)); only the excess is deductible against ordinary income, capped at $3,000/year, with the rest carrying forward under IRC §1212(b). Assumes a ${(TAX_RATE * 100).toFixed(0)}% ordinary rate and a ${(LTCG_RATE_DEFAULT * 100).toFixed(0)}% long-term rate. Taxable accounts only — losses inside IRAs, 401(k)s, HSAs and 529s are excluded because those accounts are tax-exempt under IRC §408(e)(1) and produce no current deduction. Before wash-sale checks. Not tax advice.`,
      );
    }
  }

  return lines.join('\n');
}

// ── Value ledger: the dollar value Helm has SURFACED (not a performance claim) ──

export interface LedgerLine {
  label: string;
  amount: number;
  kind: 'tax_harvest' | 'insight';
  date: string | null;
  detail?: string;
}

export interface RealizedLine {
  id: string;
  label: string;
  amount: number;
  kind: 'tlh_harvest' | 'other';
  ticker: string | null;
  date: string;
}

export interface ValueLedger {
  /** Helm's computed potential — an estimate, never called "returns". */
  surfacedTotal: number;
  lines: LedgerLine[];
  /** What the user recorded actually executing. Their record, not our claim. */
  realizedTotal: number;
  realized: RealizedLine[];
}

export async function getValueLedger(
  db: SupabaseClient,
  userId: string,
  brief: PortfolioBrief | null,
): Promise<ValueLedger> {
  const lines: LedgerLine[] = [];

  // This year's realized gains by character — harvested losses offset these
  // dollar-for-dollar before the $3,000 ordinary-income cap applies.
  let stYtd = 0;
  let ltYtd = 0;
  try {
    const { data: cg } = await db
      .from('capital_gains')
      .select('transaction_type, gain_loss, gain_loss_type')
      .eq('user_id', userId)
      .eq('tax_year', new Date().getFullYear());
    for (const g of (cg ?? []) as CapGainRow[]) {
      if (g.transaction_type !== 'sell') continue;
      if (g.gain_loss_type === 'short_term') stYtd += Number(g.gain_loss);
      else ltYtd += Number(g.gain_loss);
    }
  } catch {
    /* no capital_gains table — treat as no realized gains */
  }

  // Harvestable tax savings from current losses (the deterministic dollar).
  if (brief) {
    const totalLoss = brief.harvestableLoss.total;
    if (totalLoss > 0) {
      lines.push({
        label: 'Tax-loss harvesting surfaced (taxable accounts, estimate)',
        // §1211(b)-capped and netted against this year's realized gains — a
        // flat rate on the full loss overstated the year-one benefit, but
        // ignoring realized gains would understate it just as badly (losses
        // offset gains without limit; only the excess hits the $3,000 cap).
        amount: Math.round(
          estimateCappedTlhSavings({
            stLoss: brief.harvestableLoss.stLoss,
            ltLoss: brief.harvestableLoss.ltLoss,
            unknownLoss: brief.harvestableLoss.unknownLoss,
            stGainYtd: stYtd,
            ltGainYtd: ltYtd,
          }).cappedSavings,
        ),
        kind: 'tax_harvest',
        date: null,
        detail:
          stYtd + ltYtd > 0
            ? `offsets $${Math.round(stYtd + ltYtd).toLocaleString()} of realized gains, then the annual cap; from $${Math.round(totalLoss).toLocaleString()} of unrealized losses`
            : `deductible this year from $${Math.round(totalLoss).toLocaleString()} of unrealized losses; the rest carries forward`,
      });
    }
  }

  // Deliberately NOTHING else. Insight impact amounts are not surfaced value:
  // tax insights duplicate the harvest line (double-count, caught on Ben+Paul)
  // and spending detections would count a recurring charge as dollars Helm
  // "surfaced" ($24,942 autopay, caught on test@ 2026-07-24). The surfaced
  // column stays the one number that is deterministic and defensible: TLH.

  const surfacedTotal = lines.reduce((s, l) => s + l.amount, 0);

  // Realized events (user-recorded executions, migration 059). Missing table =
  // empty realized side; the surfaced side still renders.
  const realized: RealizedLine[] = [];
  try {
    const { data } = await db
      .from('value_events')
      .select('id, kind, amount, ticker, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    for (const r of data ?? []) {
      realized.push({
        id: String(r.id),
        label: String(r.note || (r.kind === 'tlh_harvest' ? 'Tax-loss harvest executed' : 'Realized')),
        amount: Math.round(Number(r.amount)),
        kind: r.kind as RealizedLine['kind'],
        ticker: r.ticker ? String(r.ticker).toUpperCase() : null,
        date: String(r.created_at).slice(0, 10),
      });
    }
  } catch {
    /* table not applied yet — surfaced-only ledger */
  }
  const realizedTotal = realized.reduce((s, l) => s + l.amount, 0);

  return { surfacedTotal, lines, realizedTotal, realized };
}
