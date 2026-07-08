-- 053: self-falsifying pillars. Each drafted pillar can carry its own kill
-- criterion: the concrete, checkable evidence that would break the claim.
-- Written by the AI draft (user-editable later), read by the builder UI and
-- fed to the scoring judge for sharper verdicts.
alter table thesis_pillars add column if not exists breaks_if text;
