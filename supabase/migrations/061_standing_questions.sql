-- Standing questions (research council queue item 3): a user can "watch" a
-- grounded question; the agent re-runs it against new evidence and the deltas
-- feed the weekly analyst note. last_finding_ids is the snapshot the next run
-- diffs against — new ids = new evidence worth telling the user about.

create table if not exists standing_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  active boolean not null default true,
  last_run_at timestamptz,
  last_finding_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists standing_questions_user_idx on standing_questions (user_id, active);

alter table standing_questions enable row level security;

create policy "Users can read own standing questions"
  on standing_questions for select
  using (auth.uid() = user_id);

create policy "Users can create own standing questions"
  on standing_questions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own standing questions"
  on standing_questions for delete
  using (auth.uid() = user_id);

-- Re-run bookkeeping (last_run_at / last_finding_ids) is written by the cron
-- via the service role; users never update rows directly.
