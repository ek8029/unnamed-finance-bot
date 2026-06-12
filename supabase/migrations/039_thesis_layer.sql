-- 039_thesis_layer.sql
-- Thesis layer: theses, thesis_pillars, pillar_evidence (+ macro_tier on market_news)
-- Spec: docs/superpowers/specs/2026-06-11-thesis-layer-design.md §3

create table if not exists theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  notes text,
  tracked boolean not null default false,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create table if not exists thesis_pillars (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references theses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim text not null check (length(trim(claim)) > 0),
  origin text not null check (origin in ('ai_draft', 'user')),
  confirmed boolean not null default false,
  status text not null default 'unverified'
    check (status in ('unverified', 'intact', 'weakening', 'broken')),
  status_override text
    check (status_override is null or status_override in ('unverified', 'intact', 'weakening', 'broken')),
  status_changed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pillar_evidence (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references thesis_pillars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('supports', 'contradicts', 'neutral')),
  materiality text not null check (materiality in ('material', 'context')),
  source_type text not null
    check (source_type in ('filing', 'form4', 'xbrl', 'news', 'price_move')),
  source_key text not null,
  source_title text not null,
  source_url text,
  source_published_at timestamptz,
  excerpt text not null check (length(trim(excerpt)) > 0),
  why text not null,
  what_it_means text not null,
  consider text,
  is_backfill boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pillar_id, source_key)
);

create index if not exists idx_theses_user on theses(user_id);
create index if not exists idx_theses_tracked on theses(user_id, tracked) where tracked;
create index if not exists idx_pillars_thesis on thesis_pillars(thesis_id);
create index if not exists idx_evidence_pillar on pillar_evidence(pillar_id);
create index if not exists idx_evidence_recency on pillar_evidence(pillar_id, created_at desc);

alter table theses enable row level security;
alter table thesis_pillars enable row level security;
alter table pillar_evidence enable row level security;

create policy "Users manage own theses" on theses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own pillars" on thesis_pillars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own evidence" on pillar_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Macro strip classifier flag (spec §4.4). market_news is a shared table (no RLS), same as market_prices.
alter table market_news add column if not exists macro_tier text
  check (macro_tier is null or macro_tier in ('mover'));
