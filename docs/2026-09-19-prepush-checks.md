# Pre-push checks - September 19, 2026

Checked web commit 350379f and mobile c71e206, then corrected the Apple SDK
security-policy gap described below. Nothing was pushed, deployed or promoted.

## Passed

- Production `npm run build`: committed-source snapshot, then rebuilt with the
  single CSP correction. Both exited 0; 290 static pages generated. Next's build
  TypeScript check passed. Snapshot excludes unrelated untracked application drafts.
- Full web suite: before correction, the new regression test failed as expected
  (1 failed, 1,937 passed, 2 expected failures). After correction: 1,938 passed,
  0 unexpected failures, 2 expected failures, 168 test files.
- Mobile Expo dependency check: upToDate=true, no mismatches. iOS export generated
  a Hermes bundle successfully. This is not an Xcode archive or a TestFlight test.
- Database: consent/subscription/preferences/push columns present. Deletion
  revocation ledger columns present. Anonymous reads of consent and revocation
  tables denied. Migration 076 backfill SELECT still matches zero rows.
- RevenueCat: existing subscriber lookup with the local configured key returned
  HTTP 200 and the required subscriber/entitlements response shape.
- Stripe live read-only checks: Helm webhook enabled with all five events the
  handler consumes. Current Pro monthly ($20) and annual ($149) prices are active
  and live. Legacy MONTHLY/ANNUAL/LIFETIME settings do not resolve, but no current
  app/lib/component code references them. Current checkout accepts only pro and
  pro_annual. No customer, checkout, charge or subscription was created.
- Production runtime: seven protected API requests returned 401; an unsigned
  Stripe webhook returned 400. Signup returned 200 with Apple SDK allowed and
  production unsafe-eval still excluded from the actual response policy.
- Browser: localhost production signup renders, preserves AAPL in the sign-in
  link, and displays the revised analytics notice. No application errors in that
  tab's console; Plausible intentionally skips localhost. The separate 127.0.0.1
  browser session contains malformed/expired saved authentication, so it is not
  evidence of a clean authenticated session. No account was created or deleted.

## Additional bug corrected

middleware.ts blocked the Apple SDK loaded by lib/apple-delete-browser.ts.
Added only https://appleid.cdn-apple.com to script-src; did not loosen frame,
form, wildcard or eval restrictions. Apple's SDK source uses popup messaging
(no iframe, fetch or XMLHttpRequest calls found), so no other source allowance
was added. Official SDK integration reference:
https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple

Evidence: tests/apple-csp.test.ts calls the real middleware on an authenticated
settings request and tests the returned CSP. Middleware has zero application
callers; Next invokes this route entry point. Read its complete authentication,
redirect, attribution and security-header branches before editing it. The test
mocks only the auth service boundary, no database writes or schema mocks.

## Still required before promotion / App Store release

1. Vercel inspected after Evan signed in: REVENUECAT_WEBHOOK_SECRET is present
   for Production and Preview, but REVENUECAT_API_KEY / REVENUECAT_SECRET_API_KEY
   are absent. No shared variables are linked. Add the verified lookup key to
   the appropriate hosted environments before promoting the billing changes.
2. Configure/verify Apple native revocation credentials and the web Services ID /
   return URL. Those fields are absent both locally and in Vercel. Apple-linked
   deletion cannot be certified until configuration and sandbox tests succeed.
3. Run actual authenticated purchase/restore/cancellation and Apple deletion on
   disposable test accounts and an iPhone. Verify App Store Connect disclosures
   and organization enrollment. These were not completed by compile/unit tests.
4. Evan confirmed migrations are applied through 079. Required database objects
   were independently checked. Do not reapply migrations. Files 074-076 remain
   untracked in this local checkout: source-history housekeeping, not a missing
   production migration. They were left untouched under the shared-tree rules.

## Hosted deployment settings verified after sign-in

Vercel project helmfintech is connected to ek8029/unnamed-finance-bot. Production
tracks main; Preview covers all unassigned branches. Local work is on master,
so its Git deployment is expected to be Preview; Evan's manual promotion remains
unchanged. No remote environment value or deployment setting was modified.

NEXT_PUBLIC_ONBOARDING_V3 and PLAID_TOKEN_KEY are scoped to Production only.
Preview therefore does not currently have equivalent onboarding / encrypted
Plaid-token configuration. Do not assume a preview smoke test covers those
production paths. In particular lib/plaid/token-crypto.ts refuses to unseal a
stored token without the key; changing that protection is not a workaround.

Source: Vercel project Environment Variables (all environments, project plus
shared tabs), Environments, and Git settings, inspected September 19, 2026.
https://vercel.com/evans-projects-be98d386/helmfintech/settings/environment-variables

Build warnings (non-blocking): deprecated middleware convention and Edge runtime;
workspace-root warning is caused by the isolated snapshot's nested lockfile.

## Evidence files (local, ignored)

- test-screenshots/preflight-20260919-build-final.log
- test-screenshots/preflight-20260919-before-fix-tests.log
- test-screenshots/preflight-20260919-after-fix-tests.log
- test-screenshots/preflight-20260919-services.json
- test-screenshots/preflight-20260919-runtime.json
- test-screenshots/preflight-20260919-expo-dependencies.log
- test-screenshots/preflight-20260919-ios-export.log
