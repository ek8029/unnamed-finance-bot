// What the dashboard's market-status dot should say.
//
// It read "● Live" as static text for as long as it existed, in muted grey,
// regardless of whether a quote had ever arrived. The overlay that repaints
// prices polls only 9:30-16:00 ET; after the bell the official close stands
// and nothing should claim to be live.

export type LiveState = 'live' | 'delayed' | 'connecting' | 'closed';

export interface LiveStatus {
  state: LiveState;
  label: string;
}

export const LIVE_STALE_AFTER_MS = 60_000;

export function liveStatus(
  marketOpen: boolean,
  lastQuoteAt: number | null,
  now: number,
  staleAfterMs: number = LIVE_STALE_AFTER_MS,
): LiveStatus {
  if (!marketOpen) return { state: 'closed', label: 'Market closed' };
  if (lastQuoteAt == null) return { state: 'connecting', label: 'Connecting' };
  if (now - lastQuoteAt > staleAfterMs) return { state: 'delayed', label: 'Delayed' };
  return { state: 'live', label: 'Live' };
}
