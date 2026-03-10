-- Waitlist table for pre-launch email capture + referral tracking
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES waitlist(referral_code) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);

-- Grant base permissions to anon and authenticated roles
GRANT SELECT, INSERT ON waitlist TO anon, authenticated;

-- Allow anonymous reads and inserts (public waitlist)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read waitlist entries"
  ON waitlist FOR SELECT
  USING (true);
