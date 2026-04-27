-- Email drip sequence tracking
-- Prevents duplicate sends and enables analytics

CREATE TABLE email_drip_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drip_day INTEGER NOT NULL,
    email_subject TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    UNIQUE(user_id, drip_day)
);

CREATE INDEX idx_email_drip_log_user ON email_drip_log(user_id);
CREATE INDEX idx_email_drip_log_sent ON email_drip_log(sent_at);

-- RLS: service role only (cron job writes, no user access needed)
ALTER TABLE email_drip_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE email_drip_log IS 'Tracks post-signup drip email sends to prevent duplicates';
