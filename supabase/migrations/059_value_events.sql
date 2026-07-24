-- 059_value_events.sql
-- Realized value: what the user actually EXECUTED on, recorded by them.
--
-- The value ledger's "surfaced" number is a computed potential (e.g. tax
-- savings if losses were harvested). This table holds the other half: the user
-- saying "I did this one", with the dollar amount they actually realized. The
-- distinction is the honesty line — surfaced is Helm's estimate, realized is
-- the user's record, and no surface may blur the two. Over time this is the
-- graded outcome record: found -> acted -> worth.

create table if not exists value_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('tlh_harvest', 'other')),
  amount numeric(15, 2) not null check (amount > 0),
  ticker text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_value_events_user on value_events(user_id, created_at desc);

alter table value_events enable row level security;

create policy "Users manage own value events" on value_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
