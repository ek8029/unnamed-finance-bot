/**
 * Next.js instrumentation hook — runs exactly once per process cold-start.
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use this to run a best-effort Supabase auth health check so the operator
 * gets a signup_misconfigured row in auth_events if:
 *   - Supabase project is unreachable
 *   - /auth/v1/settings returns disable_signup=true
 *   - Required env vars (HCAPTCHA_*, UPSTASH_*) are missing in production
 *
 * The check is fire-and-forget — it must not block the process from starting.
 */

export async function register() {
  // Only run on the server runtime, not the edge runtime. The captcha module
  // uses Node fetch and should not be bundled for edge.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Dynamic import so edge-runtime codepaths don't try to bundle this
  const { runSupabaseAuthHealthCheck } = await import('@/lib/captcha');

  // Fire and forget — don't block startup, don't throw
  runSupabaseAuthHealthCheck().catch((err) => {
    console.error('[instrumentation] Auth health check threw:', err);
  });
}
