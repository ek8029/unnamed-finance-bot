-- FOLLOW adoption: a user tracks one of Helm's house theses verbatim.
-- Provenance is first-class: source/house_ref on the thesis, origin='house'
-- on its pillars — inherited reasoning must never present as the user's own.

alter table theses add column if not exists source text not null default 'user';
alter table theses add column if not exists house_ref text;

alter table thesis_pillars drop constraint if exists thesis_pillars_origin_check;
alter table thesis_pillars add constraint thesis_pillars_origin_check
  check (origin in ('ai_draft', 'user', 'house'));
