/**
 * Auto-tracking budget for theses confirmed during onboarding.
 *
 * The old rule auto-tracked a thesis only when the user had zero tracked
 * theses AND the ticker happened to be their single largest holding. In
 * practice that almost never fired: of twelve real users holding theses, five
 * had nothing monitored at all, and every one of them was a trial user. They
 * confirmed a thesis, the app saved it, and the agent never looked at it again.
 *
 * A thesis the user explicitly confirmed should be watched. The cap exists
 * because score-theses runs per tracked thesis daily, so this is a cost bound,
 * not a product opinion. Three is deliberately conservative; raise it once the
 * per-thesis scoring cost is measured.
 */
export const ONBOARDING_AUTO_TRACK_CAP = 3;

/**
 * Kick off the 12-month evidence backfill for a newly tracked thesis.
 *
 * Tracking without backfilling produces an empty thesis: adverse findings
 * arrive at roughly half a per thesis per month, so a fortnight of live
 * monitoring shows most users nothing. The backfill is what puts a record on
 * the page the moment the thesis exists, which is the difference between "this
 * is watching" and "this appears broken".
 *
 * Fire-and-forget by design. The request is aborted after 3s while the route
 * keeps working server-side, and every failure path is swallowed: a thesis that
 * saved correctly must never fail because its history did not load. Backfill
 * re-triggers on the next track toggle or a manual call.
 */
export function triggerBackfill(request: Request, ticker: string): void {
  try {
    const url = new URL('/api/thesis/backfill', request.url);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ ticker }),
      signal: controller.signal,
    }).catch(() => {});
  } catch {
    // never block the caller's response on backfill
  }
}
