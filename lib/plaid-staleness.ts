/**
 * Is the institution data Plaid is serving for an item actually fresh?
 *
 * Plaid keeps polling an institution after a link, and when that polling stops
 * working it does not necessarily raise an item error. It keeps answering
 * every holdings and balance request with the last snapshot it managed to
 * fetch, and reports the real state only in `item/get`'s `status` block. A
 * connected user's Edward Jones item did exactly this from 2026-07-30: eight
 * weeks of the same snapshot, `item.error` null, and every Helm sync logged as
 * a success while he watched positions he had sold stay on his screen.
 *
 * This is the decision, kept pure so it is tested apart from the I/O.
 */

export interface ProviderProductStatus {
  last_successful_update?: string | null;
  last_failed_update?: string | null;
}

export interface ProviderItemStatus {
  investments?: ProviderProductStatus | null;
  transactions?: ProviderProductStatus | null;
}

export type FreshnessVerdict =
  | { stale: false; lastSuccessfulUpdate: string | null; ageDays: number | null }
  | { stale: true; lastSuccessfulUpdate: string; ageDays: number; reason: string };

/**
 * Institutions publish investment data on business days, and Plaid polls on
 * roughly that cadence, so a Friday update is still the latest on Monday. Five
 * calendar days survives any weekend plus a market holiday without flagging a
 * healthy item; a truly stuck one blows past it on the sixth day.
 */
export const STALE_AFTER_DAYS = 5;

/**
 * Decide from Plaid's own status block. Investments is the product whose
 * freshness a holdings screen depends on, so it is judged first; transactions
 * is the fallback for an item with no investments product. An item whose
 * status carries no timestamp at all is not judged stale, because absence of
 * evidence is not evidence of a frozen feed.
 */
export function evaluateProviderFreshness(
  status: ProviderItemStatus | null | undefined,
  now: Date,
  staleAfterDays: number = STALE_AFTER_DAYS,
): FreshnessVerdict {
  const product = status?.investments?.last_successful_update
    ? status.investments
    : status?.transactions?.last_successful_update
      ? status.transactions
      : null;

  const last = product?.last_successful_update ?? null;
  if (!last) return { stale: false, lastSuccessfulUpdate: null, ageDays: null };

  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return { stale: false, lastSuccessfulUpdate: null, ageDays: null };

  const ageDays = (now.getTime() - lastMs) / 86_400_000;
  if (ageDays <= staleAfterDays) return { stale: false, lastSuccessfulUpdate: last, ageDays };

  // A failure newer than the last success says Plaid is trying and the
  // institution is refusing; that goes in the message so the reader knows the
  // difference between "frozen" and "never polled".
  const failed = product?.last_failed_update ?? null;
  const failing = failed && Date.parse(failed) > lastMs;
  const day = last.slice(0, 10);
  const reason = failing
    ? `The institution has not returned fresh data since ${day}; Plaid's polling has been failing since ${String(failed).slice(0, 10)}`
    : `The institution has not returned fresh data since ${day}`;

  return { stale: true, lastSuccessfulUpdate: last, ageDays, reason };
}
