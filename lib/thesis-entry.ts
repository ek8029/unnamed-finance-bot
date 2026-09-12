/** Match thesis seed's symbol grammar without accepting arbitrary URL content. */
export function thesisEntryTicker(raw: string | null | undefined): string | null {
  const ticker = raw?.trim().toUpperCase() ?? '';
  return /^[A-Z.\-]{1,10}$/.test(ticker) ? ticker : null;
}

/** The Free-capable draft/confirm workflow, separate from Pro's pre-buy tools. */
export function freeThesisEntryHref(raw?: string | null): string {
  const ticker = thesisEntryTicker(raw);
  return `/dashboard/theses/classic${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}`;
}
