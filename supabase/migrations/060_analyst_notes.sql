-- Weekly analyst note: a per-user written memo composed from the week's agent
-- findings (research council 2026-07-29, queue item 2). One row per user per
-- week; citations are snapshotted so the note's receipts stay stable even if
-- the underlying findings queries change.

create table if not exists analyst_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  title text not null,
  body text not null,
  citations jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table analyst_notes enable row level security;

create policy "Users can read own analyst notes"
  on analyst_notes for select
  using (auth.uid() = user_id);

-- Writes come from the cron / scripts via the service role only.
