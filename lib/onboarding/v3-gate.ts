// The onboarding v3 gate decision, kept pure so the ordering is testable.
//
// Two rules this file exists to hold:
//
//  1. A deferral ("Do this later", or a book already on record) belongs to an
//     ACCOUNT, not a browser. The old unscoped key meant one tester's "later"
//     silently settled every later signup in the same browser, which is how a
//     brand new account got the old flow on a v3 deployment.
//  2. The gate FAILS OPEN. If the status read fails we show onboarding rather
//     than hide it: a returning user with a book sees one dismissable screen,
//     where the other direction leaves a new user with no onboarding at all and
//     nothing in the funnel to say so.
//  3. The investor demo login runs the flow on EVERY visit and persists
//     nothing, so a visitor always meets it from zero on a populated book. v2
//     had this and v3 dropped it, which is how the demo lost its onboarding
//     when the v3 flag went on. "Every visit" is per BROWSING SESSION, not per
//     page load: the first cut of this returned show-demo before any dismissal
//     was considered and skipped writing one, so "Do this later" navigated to
//     the portfolio and the gate put the flow straight back up, forever.

/** Legacy browser-wide key. Deliberately never read: see deferredKey. */
const V3_DEFERRED_PREFIX = 'helm_onboarding_v3_deferred';

/** sessionStorage key: the demo's way out for the rest of this browsing session. */
export const DEMO_DISMISSED_KEY = 'helm_onboarding_v3_demo_dismissed';

/** The localStorage key holding this account's deferral in this browser. */
export function deferredKey(userId: string) {
  return `${V3_DEFERRED_PREFIX}:${userId}`;
}

export type GateInput = {
  /** false when /api/onboarding/status did not answer with a readable body. */
  ok: boolean;
  /** The investor demo login, as the status route resolved it. */
  isDemo?: boolean;
  /** The demo chose "Do this later" in THIS browsing session (sessionStorage). */
  demoDismissed?: boolean;
  /** Persisted work: a connection, holdings or a confirmed thesis. */
  hasSavedWork?: boolean;
  /** This browser's deferral for the account the status read identified. */
  deferred?: boolean;
};

export type GateOutcome =
  /** The demo login: show every visit, in preview, and persist nothing. */
  | 'show-demo'
  /** No status read: show anyway, and say so in the event. */
  | 'show-unavailable'
  /** Already has a book: record the deferral for this account and settle. */
  | 'defer-and-settle'
  /** This account chose "later" in this browser: settle quietly. */
  | 'settle'
  /** New account, nothing on record: show onboarding. */
  | 'show';

export function decideV3Gate({ ok, isDemo, demoDismissed, hasSavedWork, deferred }: GateInput): GateOutcome {
  // The demo outranks its own book and its own long-lived deferral, because its
  // whole purpose is to be seen from zero. It does not outrank a dismissal made
  // moments ago in this same session, or there is no way out of the flow.
  if (isDemo) return demoDismissed ? 'settle' : 'show-demo';
  if (!ok) return 'show-unavailable';
  if (hasSavedWork) return 'defer-and-settle';
  if (deferred) return 'settle';
  return 'show';
}
