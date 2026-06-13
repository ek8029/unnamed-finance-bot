-- 041_pillar_lifecycle.sql
-- Accept/dismiss lifecycle instrumentation on pillars (v2 learning signal).
-- proposed: AI draft awaiting user decision
-- confirmed: accepted as-is (or user-authored)
-- edited: AI draft accepted after the user reworded the claim
-- dismissed: AI draft rejected (soft delete; excluded from all reads, kept as signal)

alter table thesis_pillars add column if not exists lifecycle text not null default 'proposed'
  check (lifecycle in ('proposed', 'confirmed', 'edited', 'dismissed'));
alter table thesis_pillars add column if not exists lifecycle_at timestamptz;

-- Backfill existing rows: anything user-authored or already confirmed counts as confirmed.
update thesis_pillars
set lifecycle = case when origin = 'user' or confirmed then 'confirmed' else 'proposed' end,
    lifecycle_at = updated_at
where lifecycle = 'proposed';
