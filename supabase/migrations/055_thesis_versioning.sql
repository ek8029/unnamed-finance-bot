-- 055_thesis_versioning.sql
-- Thesis alert upgrades (spec 2026-07-15), F4: user-edit provenance.
-- version bumps only on material USER edits (pillar claim change, pillar add/remove);
-- agent evidence flow never bumps. Nullable/defaulted: zero backfill, old rows read v1.

alter table theses add column if not exists version int not null default 1;
alter table theses add column if not exists version_updated_at timestamptz;
