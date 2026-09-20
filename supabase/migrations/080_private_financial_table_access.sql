-- Contain public financial-data access without changing customer records.
-- Owner SELECT policies remain; service_role already has BYPASSRLS.
-- Deploy service-backed waitlist/count routes alongside this migration.
BEGIN;

ALTER POLICY "Service role writes digests" ON public.brief_digests TO service_role;
ALTER POLICY "Service role writes investment transactions" ON public.investment_transactions TO service_role;
ALTER POLICY "Anyone can read waitlist entries" ON public.waitlist TO service_role;
ALTER POLICY "Anyone can join waitlist" ON public.waitlist TO service_role;

-- These policies were added through the dashboard and are absent from the
-- numbered migrations. Handle both existing production and fresh databases.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND (
      (tablename = 'user_subscriptions' AND policyname IN (
        'Allow public read of subscription counts',
        'Service and users can insert own subscriptions',
        'Users can update own subscriptions')) OR
      (tablename = 'waitlist' AND policyname = 'Users can update own waitlist entry')
    )
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', p.policyname, p.tablename);
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON public.brief_digests, public.investment_transactions,
  public.user_subscriptions, public.waitlist FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  public.brief_digests, public.investment_transactions, public.user_subscriptions FROM authenticated;
REVOKE ALL PRIVILEGES ON public.waitlist FROM authenticated;

COMMIT;
