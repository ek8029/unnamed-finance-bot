-- 072: the perpetual watch (spec docs/superpowers/specs/2026-09-05-perpetual-watch-build.md).
--
-- Two internal tables. Neither is read by the browser; both are written and
-- read only through the service-role client from crons and dev tooling, so RLS
-- is enabled with no policies at all (the service role bypasses RLS, anon and
-- authenticated get nothing).
--
-- filing_events: every filing the EDGAR feed poller saw on a watched name,
-- idempotent on accession number because the feed repeats entries. A row for a
-- held name with no thesis stays 'skipped' with a note, which is what the
-- overview shows as "8-K filed 9:02, not judged (no thesis)".
--
-- judge_jobs: every event-gated model call the watch decides to make, with the
-- tokens and cost written back when it finishes. The daily cap and the per-user
-- cap are counted from this table, and "what did the watch cost today" is a
-- SUM(cost_usd) here, not an estimate. Classifier batches are recorded as
-- kind = 'classify' rows (no user, no thesis) so the same query shows the whole
-- LLM spend; the caps exclude that kind.
--
-- Nothing user-facing depends on either table until the worklog (section 7)
-- reads them, so this migration can be applied before or after the code deploys.

create table if not exists filing_events (
  id uuid primary key default gen_random_uuid(),
  accession_no text not null unique,
  cik text not null,
  ticker text not null,
  form text not null,
  title text,
  filed_at timestamptz not null,
  url text not null,
  seen_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'queued', 'judged', 'skipped')),
  judged_at timestamptz,
  note text
);

create index if not exists idx_filing_events_ticker on filing_events(ticker, filed_at desc);
create index if not exists idx_filing_events_seen on filing_events(seen_at desc);

alter table filing_events enable row level security;

comment on table filing_events is
  'Filings the EDGAR feed poller saw on watched names. status: new = recorded, queued = judge job(s) enqueued, judged = at least one job done, skipped = no tracked thesis (note says why).';

create table if not exists judge_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('filing', 'news', 'investigate', 'classify')),
  user_id uuid references auth.users(id) on delete cascade,
  thesis_id uuid references theses(id) on delete cascade,
  pillar_id uuid references thesis_pillars(id) on delete set null,
  ticker text,
  source_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'capped', 'skipped')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  model text,
  calls int not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  evidence_added int,
  status_changes int,
  error text
);

-- The feed repeats, the news sweep re-reads, the tick fires every five
-- minutes: the same (kind, user, source) must never become two jobs. user_id
-- is NULL only for classify rows, whose source_key is unique by construction.
create unique index if not exists judge_jobs_dedupe on judge_jobs(kind, user_id, source_key);
create index if not exists idx_judge_jobs_claim on judge_jobs(status, run_after, created_at);
create index if not exists idx_judge_jobs_created on judge_jobs(created_at desc);
create index if not exists idx_judge_jobs_user on judge_jobs(user_id, created_at desc);

alter table judge_jobs enable row level security;

comment on table judge_jobs is
  'Event-gated judge work with its cost. status: queued -> running -> done | failed; capped = refused by the daily or per-user cap; skipped = thesis untracked or user unentitled at run time. cost_usd is priced by lib/ai/pricing.ts from the tokens on the row.';

-- Verify:
--   select count(*) from judge_jobs;   -- 0
--   select count(*) from filing_events; -- 0
--   select indexname from pg_indexes where tablename in ('judge_jobs', 'filing_events');
