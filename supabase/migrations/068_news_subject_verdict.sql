-- 068: is a news article ABOUT its primary ticker, or does it only mention it?
--
-- Measured 2026-09-03 on 160 production rows: 45% of what the market
-- intelligence feed served were mentions, not company stories. The verdict is
-- computed once at ingest (free shape rules, then claude-haiku on the rest)
-- and read as a filter.
--
-- Nullable with no default and no backfill on purpose: NULL means "not
-- classified", every read path shows NULL rows, so this migration cannot
-- change what anyone sees until the classifier has actually run.

ALTER TABLE market_news ADD COLUMN IF NOT EXISTS subject_verdict TEXT
  CHECK (subject_verdict IN ('about', 'mention'));

ALTER TABLE market_news ADD COLUMN IF NOT EXISTS subject_verdict_by TEXT;

COMMENT ON COLUMN market_news.subject_verdict IS
  'about = the article is about primary_ticker; mention = the company is only named. NULL = not classified.';
COMMENT ON COLUMN market_news.subject_verdict_by IS
  'Which pass decided: a rule name (e.g. "market wrapper") or the model id.';

-- The feed reads recent rows and drops mentions.
CREATE INDEX IF NOT EXISTS idx_market_news_subject
  ON market_news(published_at DESC)
  WHERE subject_verdict IS DISTINCT FROM 'mention';
