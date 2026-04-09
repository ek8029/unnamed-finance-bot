-- =========================================================================
-- 024: ANALYSIS CACHE ENHANCEMENTS (SEO + YMYL compliance)
-- =========================================================================
-- Adds provenance and versioning columns to analysis_cache so the public
-- /analyze/[ticker] pages can display "Last updated" timestamps, data
-- sources, and methodology version — required for E-E-A-T on YMYL content.
--
-- The TTL logic moves to application code (lib/analyze-stock.ts) so we can
-- shorten it during US market hours without a migration.

ALTER TABLE analysis_cache
  ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT ARRAY['finnhub.io', 'openai-gpt-4o-mini'],
  ADD COLUMN IF NOT EXISTS methodology_version TEXT DEFAULT 'v1.0';

-- Index on created_at so the freshness query stays fast as the table grows
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at
  ON analysis_cache (created_at DESC);
