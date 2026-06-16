// Plaid returns one entry per lot, so the same security in the same account can
// appear multiple times (e.g. a fund bought at different times, or cash). The
// holdings table is unique on (user_id, account_id, security_id), and an upsert
// batch with two rows sharing that key fails the WHOLE batch with Postgres 21000
// ("ON CONFLICT DO UPDATE command cannot affect row a second time"). So collapse
// lots by (account, ticker) into one position before upserting: sum the shares,
// market value, and cost basis; keep a single close price (same security).

export interface HoldingLot {
  ticker: string;
  plaid_account_id: string;
  quantity: number;
  institution_value: number | null;
  close_price: number | null;
  cost_basis: number | null;
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** Collapse multiple lots of the same security in the same account into one row. */
export function aggregateHoldingLots(lots: HoldingLot[]): HoldingLot[] {
  const byKey = new Map<string, HoldingLot>();
  for (const lot of lots) {
    const key = `${lot.plaid_account_id}::${lot.ticker}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...lot });
      continue;
    }
    existing.quantity += lot.quantity;
    existing.institution_value = sumNullable(existing.institution_value, lot.institution_value);
    existing.cost_basis = sumNullable(existing.cost_basis, lot.cost_basis);
    existing.close_price = existing.close_price ?? lot.close_price;
  }
  return [...byKey.values()];
}
