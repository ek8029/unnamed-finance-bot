# Push notifications for helm-mobile: design, not a build (2026-09-06)

Context: the 1.0.1 (build 18) review submission of 2026-09-04 sits at UNRESOLVED_ISSUES for a metadata reason (Terms of Use link). The resubmit is a chance to ship the first push-capable build and test it on a real device. This document is the design. Nothing here is built.

## 1. What exists today

Web (this repo):
- `lib/notify/deliver.ts`: THE DECISION. `pickMaterialEvents(db, userId)` applies preference, then the material threshold (`lib/notify/material.ts`), then the delivery record, and `recordDelivery(db, userId, keys, 'email' | 'push')` writes `notification_deliveries` with a channels array. Push was designed in from the start: "a different medium, its own voice, the same record so two channels never announce the same finding twice".
- Preferences on `user_preferences`: `notification_daily_brief`, `notification_market_alerts`, `notification_email` (master, email only). Read through `lib/notify/preferences.ts`, never elsewhere.
- `lib/thesis-breach.ts`: the breach alert is PAUSED (`if (true as boolean) return 0`) since 2026-08-24. Findings still land in-app and in the brief. The app's signup screen and paywall promise "tells you the moment a reason stops being true"; today no channel does.
- Bearer auth for native clients in `lib/supabase/server.ts`; helm-mobile calls every API with `Authorization: Bearer <session token>` (`lib/api.ts`).
- Deep link scheme `helm://` (app.json), used for auth today.

Mobile (`helm-mobile`, private, Expo SDK 54, `expo-dev-client` present, EAS `ascAppId` set):
- No `expo-notifications`, no `expo-device`, no `aps-environment` entitlement, no notification config. Zero push code.
- Account screen has an Alerts section with two toggles that write `notification_market_alerts` and `notification_daily_brief` (and derive `notification_email`).
- App Store description promises, under THE MORNING BRIEF: "One notification a day, and only if you want it."

Constraints that shape everything below:
- Expo Go cannot receive remote push since SDK 53. Testing needs the dev client or the TestFlight build. The resubmit build IS the test vehicle.
- Vercel functions cannot hold an APNs HTTP/2 connection pool sensibly; Expo's push service does that for us and returns receipts.
- Evan's rule from the notification layer: push gets its own voice, never an email read out on a lock screen. No em dashes, no advice language, first person only where Helm did the thing.

## 2. The four notifications, and only these

| # | Name | When | Gate | Cap |
|---|---|---|---|---|
| 1 | Brief ready | 9:15 ET, the people run, after the digest is written | `notification_daily_brief` and the OS permission | 1 a day, weekdays only (same weekend gate as the email) |
| 2 | Reason broke | the hourly scorer or the judge worker moves a pillar to broken | `notification_market_alerts` | 3 a day, 1 per ticker a day; outside 8 AM to 10 PM ET it waits for 8 AM |
| 3 | Material findings | bundled INTO #1, never a separate push | `pickMaterialEvents` (preference, threshold, record) | 0 extra |
| 4 | Severe move investigated | the intraday tick queued and finished an investigate job (severe-move trigger) | `notification_market_alerts` | shares #2's caps |

That keeps the description's promise literally true: one notification a day for the brief, and alerts only for people who turned alerts on. No badge counts in v1. No marketing pushes, ever.

Voice, by example (title 40 chars max, body 110 max, both plain):
- Brief ready: "Your brief is ready" / first sentence of the digest, cut at a sentence end.
- Reason broke: "NVDA: a reason stopped holding" / "The 10-Q contradicts your data-center margin pillar. The quote is inside."
- Brief with findings: "Your brief is ready · 2 findings" / "NVDA is 31% of the book. $4,120 harvestable across 3 lots."
- Severe move: "AMD fell 12% today. I read it against your pillars." / "Nothing contradicts a reason yet. Memo inside."

## 3. Client design (helm-mobile)

- Add `expo-notifications` and `expo-device`; config plugin in app.json. EAS adds the `aps-environment` entitlement and can create the APNs key on the individual account (`eas credentials`, Push Notifications key). No Info.plist string is required for notifications on iOS.
- Token: `getExpoPushTokenAsync({ projectId })`. Expo push tokens, routed through Expo's service, not raw APNs tokens. One integration for iOS and a future Android.
- Ask for permission at the first moment a push would have value, never at launch:
  - after a book lands (connect, import, or manual entry) on the screen that shows the first finding, and
  - when a person turns an Alert on in Account.
  A pre-permission card in Helm's voice first ("Helm tells you when a reason stops holding, and when your brief is ready. Allow notifications?"), then the system prompt. iOS grants one system prompt; a decline sends later attempts to Settings.
- Register: `POST /api/push/register { token, platform: 'ios', appVersion }` with Bearer, on every cold start when the token differs from the cached one. `DELETE /api/push/register` on sign out and on account deletion (the 5.1.1(v) path).
- Tap handling: every push carries `data: { route: 'brief' | 'thesis' | 'inbox', id? }`; the app routes on it (the `helm://` scheme already exists for auth). Foreground: `setNotificationHandler` shows a quiet banner, no sound, no badge.

## 4. Server design (this repo)

- Migration 073: `push_tokens (id, user_id, token unique, platform, app_version, created_at, last_seen_at, disabled_at, disabled_reason)`. RLS: a user reads and writes only their own rows; the service role sends.
- `app/api/push/register/route.ts`: POST upserts by token (bumps `last_seen_at`); DELETE disables. Bearer only, no cookie path.
- `lib/push/expo.ts`: sends through `https://exp.host/--/api/v2/push/send` in chunks of 100, stores ticket ids in `push_deliveries` (or on the delivery record), and a receipts pass 15 minutes later (the judge-worker minute cron can carry it) marks `DeviceNotRegistered` tokens disabled. `EXPO_ACCESS_TOKEN` in env for the higher rate limit.
- `lib/push/voice.ts`: the four composers above, pure and tested, character caps enforced.
- `lib/push/send.ts`: `sendPush(db, userId, message, keys)` = look up live tokens, send, `recordDelivery(..., 'push')` only for tokens Expo accepted. Preference is checked by the caller through `lib/notify`, the way email does it.
- Wiring: #1 and #3 from `lib/digest-cron.ts` right after the digest row is written (the email batch and the push batch share `pickMaterialEvents`, and the record makes them never double-announce). #2 from `sendBreachAlerts` in `lib/thesis-breach.ts`, which becomes: push to everyone with alerts on, email still paused. #4 from `lib/agent/judge-run.ts` after an investigate job finishes.
- Caps and quiet hours live in `lib/push/policy.ts`, pure and tested, keyed off `notification_deliveries` for the day's count.

## 5. Review and privacy

- The permission prompt must not block onboarding (it does not: it comes after the book lands, with a skip).
- App Privacy labels: the push token is used only to deliver notifications to the account that registered it, which Apple treats as not requiring a new data type; the User ID is already declared. Re-check the 11 rows before submitting 1.0.2.
- The rejection reason itself is unrelated to push; see section 7.

## 6. Test plan on the resubmit

1. Build 19 = 1.0.2 with `expo-notifications` (production profile, EAS creates the APNs key).
2. TestFlight internal build on Evan's iPhone. Sign in as an internal account. Allow notifications. Confirm a `push_tokens` row.
3. `scripts/push-test.ts` (untracked): sends each of the four composers to INTERNAL tokens only, never to a user. Verify arrival, foreground banner, and the tap route for each.
4. Turn the market-alerts toggle off and confirm silence; on and confirm delivery.
5. Only after approval: enable #1 for opted-in users, watch `notification_deliveries` with channel push for a week.

Effort: client one day, server one day, device test half a day. Cost: Expo push is free; Vercel and Supabase negligible.

## 7. The EULA rejection, diagnosed from App Store Connect (read-only, 2026-09-06)

- `GET /v1/apps/6801765915/endUserLicenseAgreement` returns 200 with a custom EULA record whose agreement text is EMPTY. So the app is in "custom EULA" mode with no license text.
- The 1.0.1 description (2,297 chars) contains no Terms of Use link, no EULA mention, no privacy mention.
- Privacy policy URL is set at the app level (helmterminal.dev/privacy). Support URL and marketing URL are set. The in-app paywall links Terms of Use and Privacy Policy (3.1.2 in-app is fine).
- Review submission of 2026-09-04: UNRESOLVED_ISSUES. Version 1.0.1: REJECTED.

Fix, two edits and no code:
1. Remove the empty custom EULA (App Information, License Agreement, use the standard Apple EULA), or via the API `DELETE /v1/endUserLicenseAgreements/{id}`.
2. Append to the description:
   `Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
   `Privacy Policy: https://helmterminal.dev/privacy`
   Then resubmit from the Resolution Center. If the resubmit carries build 19 (1.0.2), create the 1.0.2 version first; it copies 1.0.1's metadata, including the fixed description.
