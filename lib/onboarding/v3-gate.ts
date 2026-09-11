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
//     when the v3 flag went on.

/** Legacy browser-wide key. Deliberately never read: see deferredKey. */
const V3_DEFERRED_PREFIX = 'helm_onboarding_v3_deferred';

/** The localStorage key holding this account's deferral in this browser. */
export function deferredKey(userId: string) {
  return `${V3_DEFERRED_PREFIX}:${userId}`;
}

export type GateInput = {
  /** false when /api/onboarding/status did not answer with a readable body. */
  ok: boolean;
  /** The investor demo login, as the status route resolved it. */
  isDemo?: boolean;
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

export function decideV3Gate({ ok, isDemo, hasSavedWork, deferred }: GateInput): GateOutcome {
  // The demo outranks everything, including its own book and its own deferral:
  // its whole purpose is to be seen from zero.
  if (isDemo) return 'show-demo';
  if (!ok) return 'show-unavailable';
  if (hasSavedWork) return 'defer-and-settle';
  if (deferred) return 'settle';
  return 'show';
}
