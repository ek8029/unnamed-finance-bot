-- =========================================================================
-- 026: AUTH_EVENTS SIGNUP HARDENING COLUMNS
-- =========================================================================
-- Adds first-class columns for attack-pattern visibility on the signup
-- endpoint. Without this, reason/email_domain end up buried in the metadata
-- JSONB and become expensive to aggregate during an attack.
--
-- Idempotent — safe to run on a DB that has the old schema OR on one that
-- has already been partially migrated.

-- Defensive: ensure auth_events exists (migration 017 created it, but this
-- keeps 026 self-sufficient in case someone runs migrations out of order).
CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add hardening columns
ALTER TABLE auth_events
  ADD COLUMN IF NOT EXISTS email_domain TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Index on email_domain for fast "all attacks from @foo.dpdns.org" queries
CREATE INDEX IF NOT EXISTS idx_auth_events_email_domain
  ON auth_events (email_domain, created_at DESC);

-- Index on (event_type, created_at) for "how many signup_blocked in last hour"
CREATE INDEX IF NOT EXISTS idx_auth_events_type_time
  ON auth_events (event_type, created_at DESC);

-- Backfill email_domain for existing rows where email is non-null.
-- Extracts the part after the last '@'. Safe to re-run.
UPDATE auth_events
SET email_domain = lower(split_part(email, '@', 2))
WHERE email_domain IS NULL
  AND email IS NOT NULL
  AND position('@' in email) > 0;
