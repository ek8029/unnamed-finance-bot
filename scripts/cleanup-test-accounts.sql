-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️  DESTRUCTIVE — REVIEW BEFORE RUNNING  ⚠️
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This file identifies suspected bot/test accounts in auth.users so they can
-- be deleted after Phase 1 hardening is live. It does NOT delete anything on
-- its own — you must:
--
--   1. Run the SELECT statement below to see what would match
--   2. Manually confirm the results look correct (no false positives)
--   3. Run the DELETE statement separately in a transaction
--   4. Keep a copy of the IDs you deleted in case of rollback
--
-- Context: during the reconnaissance attack described in the signup hardening
-- task, ~90 accounts were created under the pattern helm-test-N@*.dpdns.org
-- and 5 under ratelimit-test-N@*.dpdns.org. None were verified. This script
-- targets those specific patterns plus the broader *.dpdns.org net.
--
-- Run in Supabase SQL Editor with the service_role key. RLS policies on
-- auth.users do not apply to the service role.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1 — REVIEW: see what would match
-- ═══════════════════════════════════════════════════════════════════════════
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email ILIKE '%@princezyj.dpdns.org'
   OR email ILIKE 'helm-test-%'
   OR email ILIKE 'ratelimit-test-%'
   OR email ILIKE '%.dpdns.org'
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 — OPTIONAL: count by pattern for sanity check
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT
--   COUNT(*) FILTER (WHERE email ILIKE '%@princezyj.dpdns.org') AS princezyj_count,
--   COUNT(*) FILTER (WHERE email ILIKE 'helm-test-%') AS helm_test_count,
--   COUNT(*) FILTER (WHERE email ILIKE 'ratelimit-test-%') AS ratelimit_test_count,
--   COUNT(*) FILTER (WHERE email ILIKE '%.dpdns.org'
--                    AND email NOT ILIKE '%@princezyj.dpdns.org') AS other_dpdns_count
-- FROM auth.users
-- WHERE email ILIKE '%@princezyj.dpdns.org'
--    OR email ILIKE 'helm-test-%'
--    OR email ILIKE 'ratelimit-test-%'
--    OR email ILIKE '%.dpdns.org';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3 — DELETE: only run after reviewing Step 1 results
-- ═══════════════════════════════════════════════════════════════════════════
-- Wrap in a transaction so you can ROLLBACK if the count looks wrong.
-- Uncomment the block below ONLY when you're ready to delete.
--
-- BEGIN;
--
-- DELETE FROM auth.users
-- WHERE email ILIKE '%@princezyj.dpdns.org'
--    OR email ILIKE 'helm-test-%'
--    OR email ILIKE 'ratelimit-test-%'
--    OR email ILIKE '%.dpdns.org';
--
-- -- Check how many rows were affected. If the number looks right, COMMIT.
-- -- If anything looks off, ROLLBACK.
-- -- COMMIT;
-- -- ROLLBACK;

-- ═══════════════════════════════════════════════════════════════════════════
-- Foreign key cascade: auth.users has ON DELETE CASCADE on auth_events
-- (via migration 017) and user_profiles, user_preferences, user_subscriptions
-- (via their own FK constraints). Deleting a user will clean up their
-- associated rows automatically — no orphans.
-- ═══════════════════════════════════════════════════════════════════════════
