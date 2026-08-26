// Pure math for repricing a holding from a last-trade print.
//
// Shared by the intraday tick (lib/market/intraday-tick.ts). Kept free of
// Supabase and Finazon so the arithmetic that feeds every value on the
// dashboard, the tax center and the mobile app can be pinned by a test.

export interface HoldingLots {
  shares: number;
  total_cost_basis: number | null;
}

export interface RepricedHolding {
  current_price: number;
  total_value: number;
  unrealised_gain_loss: number | null;
  unrealised_gain_loss_pct: number | null;
  day_change_pct: number | null;
}

export function repriceHolding(h: HoldingLots, price: number, prevClose: number | null): RepricedHolding {
  const shares = Number(h.shares) || 0;
  const totalValue = shares * price;
  const hasCost = h.total_cost_basis != null;
  const cost = hasCost ? Number(h.total_cost_basis) : 0;
  return {
    current_price: price,
    total_value: totalValue,
    unrealised_gain_loss: hasCost ? totalValue - cost : null,
    unrealised_gain_loss_pct: hasCost && cost > 0 ? (totalValue - cost) / cost : null,
    // Fraction, not percent: holdings.day_change_pct stores 0.0489 for +4.89%.
    day_change_pct: prevClose != null && prevClose > 0 ? (price - prevClose) / prevClose : null,
  };
}

/**
 * The columns a tick writes. day_change_pct is left out when it could not be
 * computed: the row then keeps the figure the last full sweep wrote (which
 * came with Finazon's own previous close), instead of dropping to null and
 * reading as "no change" on the brief.
 */
export function toHoldingUpdate(r: RepricedHolding, now: string): Record<string, number | string | null> {
  const row: Record<string, number | string | null> = {
    current_price: r.current_price,
    total_value: r.total_value,
    unrealised_gain_loss: r.unrealised_gain_loss,
    unrealised_gain_loss_pct: r.unrealised_gain_loss_pct,
    last_updated_at: now,
  };
  if (r.day_change_pct != null) row.day_change_pct = r.day_change_pct;
  return row;
}
