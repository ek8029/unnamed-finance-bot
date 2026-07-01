-- "This Week at Helm" — weekly founder-voice updates. DB-backed so entries are
-- edited from admin with no code deploy. Public reads published rows (a dated,
-- indexable asset + the source for the Monday email); writes are service-role only.
create table if not exists weekly_updates (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  title text not null,
  intro text not null default '',
  body_helm text not null default '',      -- "What changed at Helm" (hand-written)
  body_market text,                        -- "Broader market update" (auto-drafted, edited)
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_updates_week_of_idx on weekly_updates (week_of desc);
create index if not exists weekly_updates_status_idx on weekly_updates (status);

alter table weekly_updates enable row level security;

-- Anyone (logged out included) can read published entries. No public write.
drop policy if exists "weekly_updates public read published" on weekly_updates;
create policy "weekly_updates public read published"
  on weekly_updates for select
  using (status = 'published');
