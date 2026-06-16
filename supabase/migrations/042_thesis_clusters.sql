-- 042_thesis_clusters.sql
-- Persisted cross-thesis cluster cache. Clustering (lib/thesis-synthesis.clusterPillars)
-- is a temperature-0 gpt-4o call whose output depends only on the confirmed pillar set,
-- so it changes only when a pillar is added/edited/dismissed. Previously recomputed per
-- serverless instance (in-memory Map), which paid gpt-4o on every cold start. This stores
-- the result keyed by a hash of the pillar set so the page (and the cross-thesis risk
-- monitor) read it cheaply and only recompute when the pillars actually change.
-- One row per user.

create table if not exists thesis_clusters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pillar_hash text not null,
  clusters jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

alter table thesis_clusters enable row level security;

create policy "Users manage own thesis clusters" on thesis_clusters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
