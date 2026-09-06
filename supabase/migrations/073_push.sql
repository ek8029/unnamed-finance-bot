-- 073: push notifications (spec docs/superpowers/specs/2026-09-06-push-notifications.md).
--
-- push_tokens: one row per device that asked to be told. A person reads and
-- writes their own rows (the register route runs as them, over Bearer); the
-- crons send with the service role. A token Expo reports as unregistered is
-- disabled, never deleted, so the log of what was sent to whom stays whole.
--
-- push_tickets: what Expo accepted, so the receipts pass a few minutes later
-- can learn which sends actually reached APNs and which tokens have died.
-- Internal, service role only.
--
-- user_preferences.notification_push_level: the one setting behind the three
-- tiers. 'matters' is the default because that is the set the app promises.
-- The legacy toggles keep their meaning: notification_daily_brief = false
-- still silences the brief push, notification_market_alerts = false still
-- silences everything above the brief.

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text
);
create index if not exists push_tokens_live_user_idx on push_tokens(user_id) where disabled_at is null;
alter table push_tokens enable row level security;
drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists push_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token text not null,
  ticket_id text not null,
  kind text not null,
  notify_key text,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  status text,
  detail text
);
create index if not exists push_tickets_unchecked_idx on push_tickets(created_at) where checked_at is null;
alter table push_tickets enable row level security;

alter table user_preferences
  add column if not exists notification_push_level text not null default 'matters'
  check (notification_push_level in ('off', 'brief', 'matters', 'all'));
