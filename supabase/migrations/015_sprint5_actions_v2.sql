-- Migration 015: Sprint 5 - Actions Inbox V2
-- Add snooze and archive capabilities to insights

ALTER TABLE insights ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Index for snoozed insights (to efficiently query non-snoozed)
CREATE INDEX IF NOT EXISTS idx_insights_snoozed ON insights(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Index for archived insights
CREATE INDEX IF NOT EXISTS idx_insights_archived ON insights(is_archived) WHERE is_archived = TRUE;
