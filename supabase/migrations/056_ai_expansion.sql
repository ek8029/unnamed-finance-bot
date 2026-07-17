-- 056_ai_expansion.sql
-- AI expansion master spec (2026-07-16): E2 two-speed judge + E1 investigation loop.
-- All additive; code detects at runtime whether this migration is applied and
-- degrades gracefully (omits judged_by, skips investigations) until it is.

-- E2: which model's verdict is on the row (null = pre-escalation era, gpt-4o-mini)
alter table pillar_evidence add column if not exists judged_by text;

-- E1: agent-authored investigation memos, triggered by pillar status transitions
create table if not exists thesis_investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thesis_id uuid not null references theses(id) on delete cascade,
  pillar_id uuid references thesis_pillars(id) on delete set null,
  trigger_kind text not null check (trigger_kind in ('severe_move','new_filing','breach','pressure')),
  memo jsonb not null,
  model text not null,
  status text not null default 'ready' check (status in ('ready','superseded')),
  created_at timestamptz not null default now()
);

create index if not exists idx_investigations_user on thesis_investigations(user_id, created_at desc);
create index if not exists idx_investigations_thesis on thesis_investigations(thesis_id, status);

alter table thesis_investigations enable row level security;

create policy "Users read own investigations" on thesis_investigations
  for select using (auth.uid() = user_id);
-- Writes happen only via the service-role client from the cron; no insert/update
-- policy for authenticated users on purpose.
