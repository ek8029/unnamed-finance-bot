-- Watch My Tickers: email + tickers capture, no account required.
-- Double opt-in (confirm_token), one-click unsubscribe (unsub_token).
-- Service-role only: RLS enabled with no policies, same pattern as content_events.

create table if not exists watch_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tickers text[] not null,
  confirm_token uuid not null default gen_random_uuid(),
  confirmed_at timestamptz,
  unsub_token uuid not null default gen_random_uuid(),
  unsubscribed_at timestamptz,
  last_digest_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_watch_subscriptions_email on watch_subscriptions (lower(email));
create index if not exists idx_watch_subscriptions_confirm on watch_subscriptions (confirm_token);
create index if not exists idx_watch_subscriptions_unsub on watch_subscriptions (unsub_token);

alter table watch_subscriptions enable row level security;
