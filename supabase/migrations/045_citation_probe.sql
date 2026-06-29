-- Weekly AEO/GEO scoreboard. Records whether helmterminal.dev surfaces when a
-- web-search model is asked the queries Helm wants to own. One row per probe run;
-- trend hits/total over run_date to see the visibility machine working (or not).
create table if not exists citation_probe_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  model text not null,
  hits int not null,
  total int not null,
  details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists citation_probe_runs_run_date_idx
  on citation_probe_runs (run_date desc);

-- Service-role only: RLS on, no policies (matches content_events). Admin reads via
-- the service client; no user ever touches this table.
alter table citation_probe_runs enable row level security;
