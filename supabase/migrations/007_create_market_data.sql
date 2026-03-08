-- Migration 007: Market Data
-- Description: Create tables for market prices, news, SEC filings, and market events
-- Supports FMP/Finnhub price data, MarketAux news, and SEC EDGAR filings

-- =================================================================
-- MARKET PRICES
-- =================================================================

CREATE TABLE market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,

  price_date DATE NOT NULL,

  open NUMERIC(15, 4),
  high NUMERIC(15, 4),
  low NUMERIC(15, 4),
  close NUMERIC(15, 4) NOT NULL,
  volume BIGINT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(security_id, price_date)
);

-- Indexes
CREATE INDEX idx_market_prices_security_id ON market_prices(security_id);
CREATE INDEX idx_market_prices_ticker ON market_prices(ticker);
CREATE INDEX idx_market_prices_date ON market_prices(price_date DESC);

-- Comments
COMMENT ON TABLE market_prices IS 'Historical daily price data for securities';
COMMENT ON COLUMN market_prices.ticker IS 'Denormalized for query performance';

-- =================================================================
-- MARKET NEWS
-- =================================================================

CREATE TABLE market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  image_url TEXT,

  source TEXT, -- 'Bloomberg', 'Reuters', 'MarketWatch'
  author TEXT,

  published_at TIMESTAMPTZ NOT NULL,

  -- Entity linkage
  tickers TEXT[], -- Array of mentioned tickers
  sectors TEXT[], -- Related sectors

  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_market_news_published ON market_news(published_at DESC);
CREATE INDEX idx_market_news_tickers ON market_news USING GIN(tickers);
CREATE INDEX idx_market_news_sectors ON market_news USING GIN(sectors);

-- Comments
COMMENT ON TABLE market_news IS 'Market news articles with entity linkage to tickers and sectors';
COMMENT ON COLUMN market_news.tickers IS 'Array of ticker symbols mentioned in article';
COMMENT ON COLUMN market_news.sentiment IS 'Article sentiment (positive/neutral/negative)';

-- =================================================================
-- SEC FILINGS
-- =================================================================

CREATE TABLE sec_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID REFERENCES securities(id),
  ticker TEXT NOT NULL,

  filing_type TEXT NOT NULL, -- '10-K', '10-Q', '8-K', '13F'
  filing_date DATE NOT NULL,
  report_period DATE,

  title TEXT,
  url TEXT NOT NULL,

  -- Key metrics (extracted)
  revenue NUMERIC(20, 2),
  net_income NUMERIC(20, 2),
  eps NUMERIC(10, 4),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sec_filings_ticker ON sec_filings(ticker);
CREATE INDEX idx_sec_filings_type ON sec_filings(filing_type);
CREATE INDEX idx_sec_filings_date ON sec_filings(filing_date DESC);

-- Comments
COMMENT ON TABLE sec_filings IS 'SEC filing events (10-K, 10-Q, 8-K, etc.) with extracted metrics';
COMMENT ON COLUMN sec_filings.filing_type IS 'Type of SEC filing (10-K annual, 10-Q quarterly, 8-K current)';

-- =================================================================
-- MARKET EVENTS
-- =================================================================

CREATE TABLE market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type TEXT NOT NULL CHECK (event_type IN ('earnings', 'dividend', 'split', 'merger', 'ipo', 'macro', 'fed_announcement')),
  ticker TEXT,

  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Event metadata (JSONB for flexibility)
  metadata JSONB, -- e.g., {eps_estimate: 2.50, eps_actual: 2.75}

  impact_level TEXT CHECK (impact_level IN ('high', 'medium', 'low')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_market_events_type ON market_events(event_type);
CREATE INDEX idx_market_events_ticker ON market_events(ticker);
CREATE INDEX idx_market_events_date ON market_events(event_date DESC);

-- Comments
COMMENT ON TABLE market_events IS 'Market events (earnings, dividends, splits, macro events)';
COMMENT ON COLUMN market_events.metadata IS 'Event-specific data (earnings estimates, dividend amounts, etc.)';
