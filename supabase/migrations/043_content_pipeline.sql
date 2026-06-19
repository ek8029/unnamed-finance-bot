-- 043_content_pipeline.sql
-- Content automation pipeline: selected daily events + generated post drafts.
-- Both tables are service-role only (no anon RLS exposure): RLS is enabled with
-- no policies, so the service-role key bypasses RLS and the anon key sees nothing.

create table if not exists content_events (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  ticker text not null,
  company text not null,
  pillar_id text not null,
  pillar_claim text not null,
  verdict text not null,
  verbatim_cite text not null,
  cite_date timestamptz,
  source_url text not null,
  source_type text not null,
  summary text not null,
  newsworthiness numeric not null,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists content_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references content_events(id) on delete cascade,
  status text not null default 'draft',
  x_thread jsonb not null,
  linkedin_post text not null,
  caption text not null,
  slide_copy jsonb not null,
  disclaimer text not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_content_events_run_date on content_events(run_date);
create index if not exists idx_content_queue_status on content_queue(status);

-- Service-role only: enable RLS, define no policies. The service-role key used by
-- the content pipeline bypasses RLS; the anon/authenticated keys get no access.
alter table content_events enable row level security;
alter table content_queue enable row level security;
