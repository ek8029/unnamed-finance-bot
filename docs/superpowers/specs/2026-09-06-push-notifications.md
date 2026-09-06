# Push notifications for helm-mobile (2026-09-06, revised the same day)

Evan: "ideally it would be more than just one notification a day tho, big price moves, daily brief, agentics." This is the build spec. Section 7 is the App Store fix that goes with it.

## 1. What exists today

Web (this repo):
- `lib/notify/deliver.ts`: THE DECISION. `pickMaterialEvents(db, userId)` applies preference, threshold (`lib/notify/material.ts`) and the delivery record; `recordDelivery(db, userId, keys, channel)` writes `notification_deliveries` with a channels array. Push was designed in from the start: a different medium, its own voice, the same record so two channels never announce the same finding twice.
- Preferences on `user_preferences` (`notification_daily_brief`, `notification_market_alerts`, `notification_email` as the email master switch), read only through `lib/notify/preferences.ts`.
- `lib/thesis-breach.ts`: the breach alert is PAUSED since 2026-08-24. The app's signup screen and paywall promise "tells you the moment a reason stops being true"; today no channel does.
- The intraday tick (`lib/market/intraday-tick.ts`) prices every held name every 5 minutes in session and already computes severe moves (20%) into investigate jobs. The delta line on the overview already words a move as the dollar on the person's position.
- Bearer auth for native clients; helm-mobile calls every API with `Authorization: Bearer` (`lib/api.ts`). Deep link scheme `helm://`.

Mobile (`helm-mobile`, private, Expo SDK 54, dev client present, EAS `ascAppId` set): no `expo-notifications`, no entitlement, no token code. Account has an Alerts section with two toggles (market alerts, daily brief).

Constraints:
- Expo Go cannot receive remote push since SDK 53. The resubmit build (19, version 1.0.2) is the test vehicle.
- Vercel functions do not hold APNs connections; Expo's push service does, and returns receipts.
- Voice rules: its own voice, never an email read out on a lock screen. No em dashes, no advice language, first person only where Helm did the thing. Always the dollar on THEIR position, never a bare ticker move.

## 2. Three tiers, one setting

`user_preferences.notification_push_level`: `off` | `brief` | `matters` (default) | `all`. Picked in Account, replacing the two toggles. `notification_daily_brief = false` still silences the brief push; `notification_market_alerts = false` still silences tiers 2 and 3 (the legacy toggles keep meaning something for web users).

### Tier 1, the brief (`brief` and up)
| Push | When | Body |
|---|---|---|
| Brief ready | 9:15 ET weekdays, from the people run, after the digest row is written | first sentence of the digest; when `pickMaterialEvents` returns findings the title carries the count and the body leads with the first finding |

Findings ride inside this push and nowhere else. The email block and the push share one `pickMaterialEvents` result and one delivery record (channels `['email','push']`), so the brief never announces a finding twice.

### Tier 2, what matters (`matters` and up)
| Push | Source | Rule | Caps |
|---|---|---|---|
| A position moved your book | intraday tick, every 5 min in session | held name where contribution = weight x move is at least 0.5% of the book AND the move is at least 2%, or the book's own day move crosses 1.5% | 1 per ticker per day, 5 a day, names inside one tick collapse into one push |
| A reason stopped holding | hourly scorer / judge worker, pillar moves to broken | breach as today, minus the allowlist | 1 per thesis per day, counts toward the 6 |
| Severe move, investigated | judge worker finishes an investigate job | memo written | 1 per ticker per day |

Words: "NVDA +3.2% today, $4,100 on your position, 0.6% of your day." / "NVDA: a reason stopped holding. The 10-Q contradicts your margin pillar. The quote is inside." / "AMD fell 12% today. I read it against your pillars. Nothing contradicts a reason yet."

### Tier 3, everything the agent does (`all` only)
| Push | Source | Rule |
|---|---|---|
| Filing read, with a finding | judge worker, filing job with evidence added | supports or contradicts on a held name; never "read it, nothing there" |
| Earnings tomorrow | 6 PM ET the day before, people run | name at 5% or more of the book. BLOCKED today: `market_events` has zero upcoming earnings rows; data gap, not push work |
| Evening receipt | 6 PM ET | "I read 3 filings and 41 articles on your names today." Lab first; not in the first build |

### Guardrails, in `lib/push/policy.ts`, pure and tested
- Per-user cap of 6 pushes a day across tiers, counted from `notification_deliveries` rows with channel push.
- Quiet hours 10 PM to 8 AM ET: a push that would fire inside them waits for 8 AM, except nothing is deferred twice (a stale move is dropped, not sent late).
- One fact never twice: every push has a notify key and goes through `alreadyDelivered`.
- Collapse: pushes of the same kind inside one run merge into one message.

## 3. Client design (helm-mobile)

- `expo-notifications` + `expo-device`; the config plugin adds `aps-environment`. EAS creates the APNs key from the App Store Connect API key (`EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`) on a non-interactive build.
- Token: `getExpoPushTokenAsync({ projectId })`, cached; re-registered on cold start when it differs.
- Permission is asked at the first moment a push has value, never at launch: after a book lands (the first-finding screen) and when the level is changed from `off` in Account. A pre-permission card in Helm's voice first, then the system prompt.
- `POST /api/push/register { token, platform, appVersion }` with Bearer; `DELETE` on sign out and on account deletion.
- Every push carries `data: { route: 'brief' | 'thesis' | 'inbox' | 'book', id? }`; the app routes on tap. Foreground shows a quiet banner, no sound, no badge.

## 4. Server design (this repo)

- Migration 073: `push_tokens (id, user_id, token unique, platform, app_version, created_at, last_seen_at, disabled_at, disabled_reason)` with RLS (own rows), `push_tickets (id, user_id, token, ticket_id, notify_key, created_at, checked_at, status)` service-only, and `user_preferences.notification_push_level text default 'matters'`.
- `app/api/push/register/route.ts`: POST upsert by token, DELETE disable. Bearer only.
- `lib/push/expo.ts`: chunks of 100 to `https://exp.host/--/api/v2/push/send`, tickets stored, receipts checked on the minute cron; `DeviceNotRegistered` disables the token.
- `lib/push/voice.ts`: the composers, character caps enforced (title 40, body 110).
- `lib/push/policy.ts`: level, legacy toggles, caps, quiet hours, collapse.
- `lib/push/send.ts`: `sendPush(db, userId, kind, message, keys)` = policy, tokens, send, record only what Expo accepted.
- Wiring: brief + findings from `lib/digest-cron.ts`; moves from `lib/market/intraday-tick.ts` after prices land (holdings of users with live tokens only, so the tick's cost does not grow with the user base); breach from `lib/thesis-breach.ts`; investigated and filing-with-finding from `lib/agent/judge-run.ts`.

## 5. Review and privacy
- The permission prompt never blocks onboarding.
- App Privacy labels: the token is used only to deliver to the account that registered it; User ID is already declared. Re-check the 11 rows before submitting 1.0.2.

## 6. Test plan on the resubmit
1. Build 19 = 1.0.2 with the plugin, production profile, auto-submitted to App Store Connect.
2. TestFlight on Evan's iPhone, internal account, allow notifications, confirm a `push_tokens` row.
3. `scripts/push-test.ts` (untracked) sends each composer to INTERNAL tokens only. Verify arrival, banner, tap route.
4. Level `off` silences everything; `brief`, `matters`, `all` each add their tier.
5. Submit 1.0.2 for review only after the device test. After approval, watch `notification_deliveries` channel push for a week.

## 7. The EULA rejection (App Store Connect, read 2026-09-06, fixed the same day)
- The app carried a custom EULA record with EMPTY text, so Apple treated it as custom-EULA with no license. Deleted; the standard Apple EULA applies.
- The description had no Terms of Use link. Appended: `Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` and `Privacy Policy: https://helmterminal.dev/privacy`.
- "One notification a day, and only if you want it." became "Notifications for what matters to your book, and only if you want them.", because tiers 2 and 3 make the old sentence false.
- Resubmit from the Resolution Center once build 19 is attached to 1.0.2, after the device test.
