# Web and iPhone review fixes - September 19, 2026

These changes are local. No GitHub push, Vercel deployment, App Store submission,
customer deletion, purchase, or production database mutation was performed.

## Changes and evidence

- Personal AI processing checks saved, versioned permission before sending private
  portfolio questions, thesis claims, or personalized briefs to a model.
  Dashboard/settings expose Allow and Pause. Image/free-text imports require
  separate confirmation; deterministic CSV parsing remains available.
  Evidence: tests/personal-ai-boundaries.test.ts, lib/ai-consent.ts,
  components/ai-consent-panel.tsx, components/portfolio-import.tsx.
- Apple and Stripe changes reconcile current provider state together, preserving
  another active subscription and explicit permanent grants. Provider failures
  leave stored access intact and return a retryable failure.
  Evidence: tests/billing-server-boundary.test.ts, tests/billing-reconciliation.test.ts,
  tests/stripe-webhook.test.ts, tests/tier-purchase-contract.test.ts.
- Web/server/mobile analytics honor the stored usage preference. Unknown mobile
  preferences disable capture; stale account responses cannot identify the next
  user. Plausible uses the web gate and sanitized manual pageviews. HeyCatch's
  automatic tracker is paused: installed SDK 0.7 has no public opt-out/teardown.
  PostHog still measures opted-in acquisition/conversion.
  Evidence: components/posthog-provider.tsx, tests/posthog-server.test.ts,
  tests/browser-page-analytics.test.ts, mobile tests/analytics-privacy.test.cjs.
- Web deletion for Apple-linked accounts requests fresh Apple confirmation before
  calling the existing deletion endpoint. Cancellation/mismatched state supplies
  no proof. Evidence: tests/apple-browser-proof.test.ts,
  app/dashboard/settings/page.tsx, lib/apple-account-deletion.ts.
- Push registration supports the mobile client's preparation/revocation protocol.
  A revocation capability only disables its original user/token pair; notifications
  use generic lock-screen text. Evidence: app/api/push/register/route.ts,
  lib/push/send.ts, existing local tests/push-privacy.test.ts.
- Stock-analysis signup links retain the chosen ticker. Mobile onboarding's initial
  status check times out after eight seconds instead of waiting forever.
  Evidence: components/analyze/signup-cta.tsx, mobile tests/onboarding-deadline.test.cjs;
  local browser showed the AAPL destination preserved in signup's sign-in link.

## Validation

Full web suite before: 1,913 tests - 1,896 passed, 15 failed, 2 expected failures.
After: 1,939 tests - 1,937 passed, 0 failed, 2 expected failures (167 files).
Full mobile suite before: 129 passed; after: 136 passed, 0 failed.
Both repositories pass `tsc --noEmit --incremental false`.
Web command: `npm test -- --maxWorkers=4`; mobile command: `npm test`.
Logs: ignored test-screenshots/fix-20260919-*.log. Totals include existing local
review tests; unrelated untracked files were not swept into a commit.

The browser rendered signup and the revised privacy page. The local session was
expired and hCaptcha reported blocked; authenticated end-to-end signup/settings
and native-device flows are NOT verified by that browser check.

## Boundary and schema checks

Read changed shared-function callers: digest generation 1; single-thesis scoring
3; cached synthesis 2; weekly analyst note 1; trial predicate 5; server event
capture 6 call sites in 3 files; subscription reconciliation 4 call sites in 3
routes; push delivery 6 call sites in 5 files. Read import endpoint's 3 consumers,
seed endpoint's 7 web call sites, and backfill's 2 web consumers/error paths.
On mobile, read analytics identify's 2 session call sites, preference setter's
2 account call sites, and onboarding status's 1 flow caller. Scheduled writers
and webhooks were included rather than only checking interactive routes.

Read migration constraints: subscriptions UNIQUE(user_id) and constrained
 tier/source/billing period; consent PRIMARY KEY(user_id) with exactly one of
 granted_at/revoked_at; preferences UNIQUE(user_id); push UNIQUE(token) plus
 owner/platform constraints. Billing boundary fixtures enforce one owner row,
 allowed values, and updated_at compare-and-swap. No real writes occur in tests.

`node scripts/check-review-schema.cjs` confirmed required columns are readable
in the configured database. Migration 076's backfill SELECT matched 0 rows.
No migration was applied. Dependency traversal of the proposed changed files
found no missing untracked imports once integrated helper files are included.

## Deployment and device follow-up

RevenueCat lookup configuration was added to ignored local environment settings
using the app's existing public SDK key. Hosted configuration is UNVERIFIED.
The Apple web Services ID and return URL are absent locally; .env.example
 documents the required client/server settings. They must match Apple configuration.
Apple organizational enrollment/DUNS changes were not modified by this work.

Before release: verify hosted RevenueCat/Apple settings, then run sandbox
purchase/restore/cancellation and Apple-linked deletion on a designated test
account/device. Unit tests do not prove those external flows.
