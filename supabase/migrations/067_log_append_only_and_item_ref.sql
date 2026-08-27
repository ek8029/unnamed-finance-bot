-- Migration 067: security logs become append-only; linked_accounts stops holding
-- the Plaid access token and points at plaid_items instead.
--
-- Why: the public Information Security Policy described a "tamper-resistant
-- audit table" and "encrypted" Plaid tokens. Neither was true. This migration
-- makes the first true at the database level and clears the way for the
-- second (the application now seals plaid_items.plaid_access_token with
-- AES-256-GCM; see lib/plaid/token-crypto.ts). Apply BEFORE promoting the
-- code that references linked_accounts.plaid_item_ref.

-- ---------------------------------------------------------------------------
-- 1. linked_accounts.plaid_item_ref replaces the raw token as the join key
-- ---------------------------------------------------------------------------
ALTER TABLE linked_accounts
  ADD COLUMN IF NOT EXISTS plaid_item_ref UUID REFERENCES plaid_items(id) ON DELETE SET NULL;

-- Backfill while both sides are still plaintext (this runs before any token is sealed).
UPDATE linked_accounts la
SET plaid_item_ref = pi.id
FROM plaid_items pi
WHERE la.plaid_item_ref IS NULL
  AND la.plaid_access_token IS NOT NULL
  AND pi.plaid_access_token = la.plaid_access_token;

CREATE INDEX IF NOT EXISTS idx_linked_accounts_plaid_item_ref ON linked_accounts(plaid_item_ref);

-- The token is now held once, in plaid_items.
UPDATE linked_accounts SET plaid_access_token = NULL WHERE plaid_item_ref IS NOT NULL;

COMMENT ON COLUMN linked_accounts.plaid_access_token IS
  'Legacy. No longer written; NULL wherever plaid_item_ref is set. The token lives only in plaid_items.';
COMMENT ON COLUMN plaid_items.plaid_access_token IS
  'Plaid access token, sealed by the application with AES-256-GCM (prefix enc:v1:) when PLAID_TOKEN_KEY is set. Rows written before the key existed are plaintext until their next sync re-seals them.';

-- ---------------------------------------------------------------------------
-- 2. auth_events and audit_logs are append-only, service role included
-- ---------------------------------------------------------------------------
-- Allowed: INSERT (anyone with insert rights), the ON DELETE CASCADE that
-- follows a user's own account deletion (auth_events.user_id), and the
-- ON DELETE SET NULL that follows it (audit_logs.user_id). Everything else
-- raises, whatever role runs it. RLS does not bind the service role; a
-- trigger does.
CREATE OR REPLACE FUNCTION public.helm_log_rows_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A row may vanish only when the user it belongs to has already been deleted
    -- (the referential cascade). Rows with no user are never deletable.
    IF OLD.user_id IS NULL
       OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
      RAISE EXCEPTION 'security log rows are append-only (%.%)', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: the only change permitted is user_id becoming NULL (ON DELETE SET NULL).
  IF NEW.user_id IS NULL
     AND OLD.user_id IS NOT NULL
     AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'security log rows are append-only (%.%)', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS auth_events_append_only ON auth_events;
CREATE TRIGGER auth_events_append_only
  BEFORE UPDATE OR DELETE ON auth_events
  FOR EACH ROW EXECUTE FUNCTION public.helm_log_rows_are_append_only();

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.helm_log_rows_are_append_only();

-- Belt and braces for the user-facing roles; the trigger is what binds the service role.
REVOKE UPDATE, DELETE, TRUNCATE ON auth_events FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM anon, authenticated;

COMMENT ON TABLE auth_events IS
  'Authentication events. Append-only: the trigger auth_events_append_only rejects UPDATE and DELETE for every role, except the cascade after the user row itself is deleted.';
COMMENT ON TABLE audit_logs IS
  'Service events (Plaid webhooks). Append-only: the trigger audit_logs_append_only rejects UPDATE and DELETE for every role, except user_id becoming NULL after the user row is deleted.';
