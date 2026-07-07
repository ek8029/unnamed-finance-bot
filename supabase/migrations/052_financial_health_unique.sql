-- 052: financial_health_scores upsert has been failing on every call.
-- computeSnapshots does `.upsert({...}, { onConflict: 'user_id' })`, but the table
-- (migration 010) has only PRIMARY KEY(id) — no UNIQUE(user_id). Postgres rejects
-- onConflict with no matching unique index (42P10), so the health score never
-- persists (stale/absent for everyone), and the write is unchecked so it's silent.
-- Also add the missing UPDATE RLS policy (only SELECT/INSERT existed) so the
-- user-client caller (financial-summary route) can refresh it, not just the cron.

-- 1. Dedupe any pre-existing rows so the unique index can be created (keep latest).
DELETE FROM financial_health_scores a
USING financial_health_scores b
WHERE a.user_id = b.user_id
  AND a.calculated_at < b.calculated_at;

-- 2. The constraint the upsert needs.
ALTER TABLE financial_health_scores
  ADD CONSTRAINT financial_health_scores_user_id_key UNIQUE (user_id);

-- 3. Let a user update their own row (INSERT ... ON CONFLICT DO UPDATE needs it).
CREATE POLICY "Users can update own health score"
  ON financial_health_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
