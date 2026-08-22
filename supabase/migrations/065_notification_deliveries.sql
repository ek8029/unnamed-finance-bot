-- 065_notification_deliveries.sql
-- THE DELIVERY RECORD. Build this before any notifier, not after.
--
-- Helm regenerates insights on every daily run. Without a record of what a
-- person has already been told, a notifier re-announces the same unchanged fact
-- every morning: the same concentration, the same harvestable loss, until the
-- alert is worth nothing and the address is dead.
--
-- WHY THIS IS A TABLE AND NOT A COLUMN ON `insights`.
-- Insight rows churn. lib/insights-engine refreshes its rows in place, but
-- lib/thesis-actions, lib/thesis-investigation and lib/cross-thesis-risk all
-- dismiss the old row and INSERT a new one on every run. A `notified_at` column
-- would arrive on each new row as NULL and the notifier would announce the same
-- finding again the next day. So the record keys on the FACT, not on the row
-- that happens to be carrying it. `notify_key` is that fact's identity: stable
-- while the finding is unchanged, different once it materially changes.
--
-- WHY `channels` IS AN ARRAY AND NOT ONE ROW PER CHANNEL.
-- One decision, several transports. Email ships first and push follows in a
-- later native build; keying the record per channel would mean the day push is
-- switched on, every fact already emailed is "undelivered by push" and the
-- entire backlog fires at once as somebody's first ever notification. A single
-- decision row makes that impossible. `channels` records which transports
-- actually carried it, which is what a delivery log is for.

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Identity of the fact. See lib/notify/material.ts: built from the stable
  -- parts of a finding (kind, ticker, normalized title) and deliberately NOT
  -- from the dollar amount, which drifts with the market every single day.
  notify_key text not null,

  -- Transports that carried it: 'email', later 'push'.
  channels text[] not null default '{}',

  first_sent_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),

  unique (user_id, notify_key)
);

create index if not exists idx_notification_deliveries_user
  on notification_deliveries(user_id, last_sent_at desc);

alter table notification_deliveries enable row level security;

-- Readable by the person it is about, so "what has Helm told me" can be a
-- surface later. Writes are service-role only: nothing in a browser or a phone
-- should be able to mark a fact as already delivered and suppress its own alert.
create policy "Users read own notification deliveries" on notification_deliveries
  for select using (auth.uid() = user_id);

comment on table notification_deliveries is
  'One row per fact per user that Helm has announced. Suppresses repeat announcements of unchanged findings across insight-row churn.';
comment on column notification_deliveries.notify_key is
  'Stable identity of the announced fact. Excludes volatile dollar amounts so a drifting number does not re-announce.';
