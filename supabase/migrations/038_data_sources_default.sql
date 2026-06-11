-- Update analysis_cache.data_sources DEFAULT to current vendor stack.
-- The old default (finnhub.io, openai-gpt-4o-mini) predates the June 2026
-- migration to Finazon + SEC EDGAR + RSS news and Claude for narratives.
-- Existing rows were already backfilled; this fixes the column default so
-- inserts that omit data_sources stop claiming retired vendors.

ALTER TABLE analysis_cache
  ALTER COLUMN data_sources
  SET DEFAULT ARRAY['finazon.io', 'sec-edgar', 'nasdaq-rss', 'yahoo-finance-rss'];
