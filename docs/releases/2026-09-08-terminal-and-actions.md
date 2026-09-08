# Terminal refinement and saved Actions

This release updates Helm's homepage and investment terminal, improves setup
and account recovery, and fixes saved Actions disappearing when an investor has
no active Plaid connection.

## What changed

- Refined the homepage and terminal around Helm's existing colors and logo, with
  clearer navigation, setup prompts and readable captures of actual app components.
- Preserved purchase intent through sign-in and made manual portfolio saves
  recoverable without silently duplicating positions.
- Replaced misleading account-sync success with actual provider outcomes and
  recovery options. Missing balances remain unavailable instead of becoming zero.
- Made Actions use the same saved-insight loader on initial entry and refresh.
  Navigating away and back no longer hides saved results for manual portfolios
  or accounts without a Plaid connection. Failed refreshes retain visible results.
- Clarified the difference between saved account balances and an active bank
  connection. Connection uncertainty is no longer labeled simply "Not verified."
- Preserved investment concentration/performance insights across inbox refreshes,
  and kept thesis context and recommendation access consistent across both reads.
- Improved news-context handling and research-symbol validation at the reviewed
  application boundaries. Unsupported research symbols receive an explanation.

## Validation

The exact release passes 113 test files: 1,052 passing tests and two expected
failures, with no unexpected failures. This includes six new Actions regression
tests. TypeScript and the Vercel production build pass; 252 static pages generated.

Local browser checks verified saved Actions on first entry, simulated analysis
refresh, navigation away and back, a full reload, and a failed-refresh error that
preserves existing cards. The mobile viewport had no horizontal overflow.
Account fixtures covered missing, active, unmatched, manual and failed connections.

No migration is introduced by this release. Live Plaid reconnection and real
payment completion were not exercised in these checks. This does not add full
share-class research support or unify every legacy valuation formula.

## Release history

- `427d258`: terminal refinement, activation and data-integrity fixes.
- `05f5b8b`: saved Actions persistence and clearer account-connection labels.

GitHub is the source for deployments. Vercel builds the pushed commit
automatically; production promotion remains manual.
