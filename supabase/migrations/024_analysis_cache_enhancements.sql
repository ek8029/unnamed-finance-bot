-- =========================================================================
-- 024: ANALYSIS CACHE (public stock analysis) + SEO/YMYL columns
-- =========================================================================
-- This migration is self-sufficient: it creates the analysis_cache table if
-- it doesn't already exist (the table was originally defined in the
-- consolidated supabase-migrations.sql but was never in a numbered
-- migration), then adds provenance columns so public /analyze/[ticker]
-- pages can display "Last updated" timestamps, data sources, and
-- methodology version — required for E-E-A-T on YMYL content.
--
-- The TTL logic lives in application code (lib/analyze-stock.ts) so we can
-- shorten it during US market hours without a migration.

-- Base table (idempotent — safe to run whether or not it already exists)
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker_created
  ON analysis_cache (ticker, created_at DESC);

-- Provenance columns for SEO / YMYL compliance
ALTER TABLE analysis_cache
  ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT ARRAY['finnhub.io', 'openai-gpt-4o-mini'],
  ADD COLUMN IF NOT EXISTS methodology_version TEXT DEFAULT 'v1.0';

-- Freshness query index
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at
  ON analysis_cache (created_at DESC);

-- Row-level security: public read (it's public cache data), service-role write
ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_cache'
      AND policyname = 'Anyone can read analysis cache'
  ) THEN
    CREATE POLICY "Anyone can read analysis cache"
      ON analysis_cache
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_cache'
      AND policyname = 'Service role can manage analysis cache'
  ) THEN
    CREATE POLICY "Service role can manage analysis cache"
      ON analysis_cache
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
