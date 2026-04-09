-- =========================================================================
-- 025: MARKET NEWS PRIMARY TICKER
-- =========================================================================
-- Fix for incorrect portfolio news associations. Polygon's news API returns
-- articles with ALL tangentially mentioned tickers in the `tickers` array.
-- A Spotify article that mentions Apple Music gets tagged with ['SPOT', 'AAPL'].
-- When a user with AAPL loads their brief, the article shows up as "AAPL news"
-- even though it's really about SPOT.
--
-- Fix: a new `primary_ticker` column that holds the article's actual subject,
-- computed at ingestion time via title + company-name analysis. Queries filter
-- on primary_ticker, not the full tickers array.

ALTER TABLE market_news
  ADD COLUMN IF NOT EXISTS primary_ticker TEXT;

CREATE INDEX IF NOT EXISTS idx_market_news_primary_ticker
  ON market_news (primary_ticker);

-- Backfill existing rows: use the first element of the tickers array as a
-- safe fallback. Polygon generally lists the most relevant ticker first, so
-- this is often correct. New articles will get proper detection via the
-- application code.
UPDATE market_news
SET primary_ticker = tickers[1]
WHERE primary_ticker IS NULL
  AND tickers IS NOT NULL
  AND array_length(tickers, 1) > 0;
