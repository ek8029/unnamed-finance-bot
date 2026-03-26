-- Pro tier interest / waitlist
CREATE TABLE IF NOT EXISTS pro_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'pricing',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE pro_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own pro_waitlist entry"
  ON pro_waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own entry"
  ON pro_waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role full access"
  ON pro_waitlist FOR ALL
  USING (auth.role() = 'service_role');
