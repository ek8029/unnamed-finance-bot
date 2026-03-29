CREATE POLICY "Authenticated users can insert institutions"
  ON institutions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own portfolio performance"
  ON portfolio_performance FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own waitlist entry"
  ON waitlist FOR UPDATE
  USING (true);
