// Service-role account reads for the research engine. The shipped
// getPortfolioSummary / generateTaxReport are bound to the request session
// (createClient with cookies), so they cannot serve an arbitrary account under a
// service client — the /testing surface and any cron-style caller need these
// self-contained equivalents. All reads are user-scoped and best-effort.

import type { SupabaseClient } from '@supabase/supabase-js';
import { TAX_RATE } from '@/lib/financial-config';

export interface BriefHolding {
  ticker: string;
  value: number;
  pct: number;
  unrealizedGainLoss: number | null;
  costBasis: number | null;
  sector: string | null;
  /** Account names this position spans (multi-brokerage books hold one name in 2+). */
  accounts: string[];
}

export interface PortfolioBrief {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealized: number;
  positionCount: number;
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
        'ticker, total_value, unrealised_gain_loss, total_cost_basis, portfolio_allocation_pct, securities(sector), linked_accounts(account_name)',
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
    for (const h of data) {
      const sec = h.securities as { sector?: string | null } | { sector?: string | null }[] | null;
      const sector = Array.isArray(sec) ? (sec[0]?.sector ?? null) : (sec?.sector ?? null);
      const acc = h.linked_accounts as { account_name?: string | null } | { account_name?: string | null }[] | null;
      const accountName = Array.isArray(acc) ? (acc[0]?.account_name ?? null) : (acc?.account_name ?? null);
      const ticker = String(h.ticker).toUpperCase();
      const value = Number(h.total_value ?? 0);
      const gain = h.unrealised_gain_loss != null ? Number(h.unrealised_gain_loss) : null;
      const basis = h.total_cost_basis != null ? Number(h.total_cost_basis) : null;
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
        });
      } else {
        prev.value += value;
        prev.unrealizedGainLoss =
          gain != null ? (prev.unrealizedGainLoss ?? 0) + gain : prev.unrealizedGainLoss;
        prev.costBasis = basis != null ? (prev.costBasis ?? 0) + basis : prev.costBasis;
        prev.sector = prev.sector ?? sector;
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

    return { totalValue, totalCostBasis, totalUnrealized, positionCount: holdings.length, holdings, sectorAllocation };
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
      const net = st + lt;
      lines.push(
        `=== REALIZED CAPITAL GAINS (${year} YTD) ===`,
        `Short-term net: ${st >= 0 ? '+' : ''}$${Math.round(st).toLocaleString()}`,
        `Long-term net: ${lt >= 0 ? '+' : ''}$${Math.round(lt).toLocaleString()}`,
        `Net realized: ${net >= 0 ? '+' : ''}$${Math.round(net).toLocaleString()}`,
        `Estimated tax on realized gains (~${Math.round(TAX_RATE * 100)}% blended): $${Math.round(Math.max(0, net) * TAX_RATE).toLocaleString()}`,
      );
    }
  } catch {
    /* no capital_gains — skip realized */
  }

  // Harvestable, from current unrealized losses.
  if (brief) {
    const losers = brief.holdings.filter((h) => (h.unrealizedGainLoss ?? 0) < 0);
    if (losers.length > 0) {
      const totalLoss = losers.reduce((s, h) => s + Math.abs(h.unrealizedGainLoss ?? 0), 0);
      lines.push(
        '',
        '=== HARVESTABLE LOSSES (current unrealized, positions in the red) ===',
        `Total harvestable loss: $${Math.round(totalLoss).toLocaleString()} across ${losers.length} positions`,
        `Estimated tax savings if realized (~${Math.round(TAX_RATE * 100)}% blended): $${Math.round(totalLoss * TAX_RATE).toLocaleString()}`,
        ...losers
          .slice(0, 8)
          .map((h) => `  ${h.ticker}: unrealized -$${Math.round(Math.abs(h.unrealizedGainLoss ?? 0)).toLocaleString()}`),
        'Note: estimate at a blended rate, before wash-sale checks. Not tax advice.',
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

  // Harvestable tax savings from current losses (the deterministic dollar).
  if (brief) {
    const totalLoss = brief.holdings
      .filter((h) => (h.unrealizedGainLoss ?? 0) < 0)
      .reduce((s, h) => s + Math.abs(h.unrealizedGainLoss ?? 0), 0);
    if (totalLoss > 0) {
      lines.push({
        label: 'Tax-loss harvesting surfaced',
        amount: Math.round(totalLoss * TAX_RATE),
        kind: 'tax_harvest',
        date: null,
        detail: `~${Math.round(TAX_RATE * 100)}% blended on $${Math.round(totalLoss).toLocaleString()} of unrealized losses`,
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
