-- 058_mechanism_cache.sql
-- Cached LLM mechanism grouping for thesis v2 (spec 2026-07-21 §5).
--
-- The judge (lib/content/mechanism-judge.ts) makes one gpt-4o call per pillar
-- to group findings by underlying mechanism. Grouping depends only on the set
-- of findings, so it is computed offline (script/cron), stored here keyed by a
-- hash of the member ids, and pages read cache-or-heuristic. Same shape as
-- thesis_clusters (042): derived data, service-role writes only.
--
-- scope_key = "<TICKER>|<normalised pillar claim>", the same pillar-group key
-- the scoring reader folds on.

create table if not exists mechanism_cache (
  scope_key text primary key,
  evidence_hash text not null,
  groups jsonb not null default '[]'::jsonb,
  model text not null,
  generated_at timestamptz not null default now()
);

alter table mechanism_cache enable row level security;
-- No user policies on purpose: derived from cross-user pooled evidence and
-- read/written only through the service-role client.
