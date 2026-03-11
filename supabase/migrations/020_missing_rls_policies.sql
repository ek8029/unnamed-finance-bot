-- =================================================================
-- Migration 020: Add missing RLS policies for sync operations
-- Fixes: snapshots upsert failures, securities insert failures
-- =================================================================

-- net_worth_snapshots: needs UPDATE for upsert (onConflict: user_id,snapshot_date)
CREATE POLICY "Users can update own net worth snapshots"
  ON net_worth_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cash_flow_snapshots: needs UPDATE for upsert (onConflict: user_id,snapshot_month)
CREATE POLICY "Users can update own cash flow snapshots"
  ON cash_flow_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- securities: needs INSERT for upsert (onConflict: ticker)
-- Securities are shared (not per-user), so allow authenticated users to insert
CREATE POLICY "Authenticated users can insert securities"
  ON securities FOR INSERT
  TO authenticated
  WITH CHECK (true);
