export interface FirstReadItem {
  last_holdings_sync?: string | null;
  last_balances_sync?: string | null;
  available_products?: string[] | null;
  billed_products?: string[] | null;
  consented_products?: string[] | null;
}

/** A completed empty investments pull is an answer, including a cash-only book. */
export function firstReadState(positions: number, accounts: number, items: FirstReadItem[]): 'ready' | 'syncing' | 'empty' {
  if (positions > 0) return 'ready';
  if (items.length === 0) return accounts > 0 ? 'ready' : 'empty';
  const valid = (value: string | null | undefined) => !!value && Number.isFinite(Date.parse(value));
  const complete = items.every((item) => {
    if (valid(item.last_holdings_sync)) return true;
    const investments = [...(item.available_products ?? []), ...(item.billed_products ?? []), ...(item.consented_products ?? [])].includes('investments');
    return !investments && valid(item.last_balances_sync);
  });
  return complete ? 'ready' : 'syncing';
}
