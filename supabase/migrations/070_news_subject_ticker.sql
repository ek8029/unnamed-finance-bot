-- 070: when an article is filed under the wrong company, say which company it
-- is actually about.
--
-- Per-ticker RSS tags every article with the feed's own symbol, so a Costco
-- story arrives tagged AMZN. Migration 068 taught the pipeline to recognise
-- that as a mention and hide it. That throws away a real article: it is the
-- wrong reader's news, not nobody's.
--
-- subject_ticker is the model's answer to "then who is it about", validated
-- against the securities table before it is stored. primary_ticker is
-- deliberately NOT rewritten, so the scorer and the digest see exactly what
-- they saw before and this cannot regress them.

ALTER TABLE market_news ADD COLUMN IF NOT EXISTS subject_ticker TEXT;

COMMENT ON COLUMN market_news.subject_ticker IS
  'For a row whose subject_verdict is mention: the ticker the article is actually about, validated against securities. NULL when unknown or not applicable.';

CREATE INDEX IF NOT EXISTS idx_market_news_subject_ticker
  ON market_news(subject_ticker, published_at DESC)
  WHERE subject_ticker IS NOT NULL;
