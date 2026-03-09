-- Migration 016: Allow authenticated users to write market data
-- Price refresh, news refresh, and market data endpoints need write access
-- to shared reference tables. Previously only SELECT policies existed,
-- causing all writes to silently fail.

-- =================================================================
-- MARKET PRICES — INSERT + UPDATE for price refresh
-- =================================================================
CREATE POLICY "Authenticated users can insert market prices"
  ON market_prices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update market prices"
  ON market_prices FOR UPDATE
  TO authenticated
  USING (true);

-- =================================================================
-- SECURITIES — UPDATE for price + metadata enrichment
-- =================================================================
CREATE POLICY "Authenticated users can update securities"
  ON securities FOR UPDATE
  TO authenticated
  USING (true);

-- =================================================================
-- MARKET NEWS — INSERT for news refresh from Polygon
-- =================================================================
CREATE POLICY "Authenticated users can insert market news"
  ON market_news FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update market news"
  ON market_news FOR UPDATE
  TO authenticated
  USING (true);

-- =================================================================
-- MARKET EVENTS — INSERT for dividends, splits, earnings from Polygon
-- =================================================================
CREATE POLICY "Authenticated users can insert market events"
  ON market_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update market events"
  ON market_events FOR UPDATE
  TO authenticated
  USING (true);

-- =================================================================
-- SEC FILINGS — INSERT for filing data
-- =================================================================
CREATE POLICY "Authenticated users can insert sec filings"
  ON sec_filings FOR INSERT
  TO authenticated
  WITH CHECK (true);
