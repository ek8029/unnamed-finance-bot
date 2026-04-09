/**
 * hCaptcha verification + Supabase auth settings health check.
 *
 * Two responsibilities:
 *   1. verifyHCaptcha — server-side verification of the token the client
 *      obtained from the hCaptcha widget. Must run BEFORE supabase.auth.signUp().
 *   2. runSupabaseAuthHealthCheck — called from instrumentation.ts on boot.
 *      Hits the public Supabase /auth/v1/settings endpoint and logs a
 *      misconfiguration event if signup is disabled or the endpoint is
 *      unreachable.
 *
 * IMPORTANT: the Supabase public settings endpoint does not expose whether
 * hCaptcha is enabled (that's a server-side security setting, not returned
 * to clients). We cannot programmatically verify dashboard CAPTCHA state.
 * What we CAN check:
 *   - The Supabase project is reachable
 *   - Signup is not disabled
 *   - Our own HCAPTCHA_SECRET_KEY env var is set in production
 *
 * Dashboard CAPTCHA must be manually enabled by the operator. See the
 * README comment at the top of app/api/auth/signup/route.ts for the
 * direct link.
 */

import { logAuthEvent } from '@/lib/auth-security';

const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify';

/** Thrown when hCaptcha verification is required but HCAPTCHA_SECRET_KEY is missing in production. */
export class MissingCaptchaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingCaptchaConfigError';
  }
}

export interface CaptchaVerifyResult {
  success: boolean;
  /** Present when success=false; internal code for logging only. Never surface to client. */
  reason?: 'missing_token' | 'verify_failed' | 'verify_error';
  errorCodes?: string[];
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Verify an hCaptcha token against hCaptcha's siteverify API.
 *
 * Missing-env behavior:
 *   - development: logs warning and returns success=true (fail OPEN)
 *   - production:  throws MissingCaptchaConfigError (fail CLOSED)
 *
 * @param token The `h-captcha-response` token from the client widget
 * @param remoteip The client's IP (optional, improves verification accuracy)
 */
export async function verifyHCaptcha(
  token: string | null | undefined,
  remoteip?: string,
): Promise<CaptchaVerifyResult> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;

  if (!secret) {
    if (isProduction) {
      throw new MissingCaptchaConfigError(
        'HCAPTCHA_SECRET_KEY is not set. Signup is disabled until hCaptcha is configured.',
      );
    }
    console.warn(
      '[captcha] HCAPTCHA_SECRET_KEY not set in development — captcha verification skipped. Configure before deploying to production.',
    );
    return { success: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, reason: 'missing_token' };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteip) body.set('remoteip', remoteip);

    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Short timeout — don't block the signup pipeline on a captcha API hiccup
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { success: false, reason: 'verify_error' };
    }

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success) return { success: true };

    return {
      success: false,
      reason: 'verify_failed',
      errorCodes: data['error-codes'],
    };
  } catch (err) {
    console.error('[captcha] Verification request failed:', err);
    return { success: false, reason: 'verify_error' };
  }
}

/**
 * Boot-time health check for the Supabase auth configuration. Called from
 * instrumentation.ts so it runs exactly once per cold-start.
 *
 * Logs a signup_misconfigured event to auth_events if:
 *   - Supabase URL is missing
 *   - /auth/v1/settings is unreachable
 *   - Signup is disabled at the project level
 *   - HCAPTCHA_SECRET_KEY is missing in production
 *   - Upstash env vars are missing in production
 *
 * Does NOT throw — this is a best-effort observability signal, not a gate.
 * The signup route itself enforces fail-closed-in-production for missing env.
 */
export async function runSupabaseAuthHealthCheck(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const misconfigurations: string[] = [];

  // Check 1: required env vars
  if (!url) misconfigurations.push('SUPABASE_URL_MISSING');
  if (!anonKey) misconfigurations.push('SUPABASE_ANON_KEY_MISSING');
  if (isProduction) {
    if (!process.env.HCAPTCHA_SECRET_KEY) misconfigurations.push('HCAPTCHA_SECRET_MISSING');
    if (!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) misconfigurations.push('HCAPTCHA_SITE_KEY_MISSING');
    if (!process.env.UPSTASH_REDIS_REST_URL) misconfigurations.push('UPSTASH_URL_MISSING');
    if (!process.env.UPSTASH_REDIS_REST_TOKEN) misconfigurations.push('UPSTASH_TOKEN_MISSING');
  }

  // Check 2: Supabase project reachability + signup status
  // Only if URL + anon key are present — otherwise the fetch would 404
  if (url && anonKey) {
    try {
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        misconfigurations.push(`SUPABASE_SETTINGS_${res.status}`);
      } else {
        const settings = (await res.json()) as {
          disable_signup?: boolean;
          external?: Record<string, boolean>;
        };
        if (settings.disable_signup === true) {
          misconfigurations.push('SUPABASE_SIGNUP_DISABLED');
        }
        // Note: settings endpoint does NOT return captcha_enabled. We rely on
        // our own HCAPTCHA_SECRET_KEY env var as a proxy for "operator has
        // configured captcha". Dashboard CAPTCHA must be manually verified.
      }
    } catch (err) {
      misconfigurations.push('SUPABASE_SETTINGS_UNREACHABLE');
      console.error('[health] Supabase auth settings fetch failed:', err);
    }
  }

  if (misconfigurations.length === 0) {
    console.log('[health] Supabase auth health check OK');
    return;
  }

  const severity = isProduction ? 'error' : 'warn';
  console[severity](
    `[health] Supabase auth misconfiguration${isProduction ? ' (PRODUCTION)' : ' (development, non-fatal)'}:`,
    misconfigurations,
  );

  // Log a best-effort auth_events row so the operator has visibility without
  // digging through Vercel logs. Wrapped in try/catch because logAuthEvent
  // itself is best-effort.
  try {
    await logAuthEvent({
      eventType: 'signup_misconfigured',
      metadata: {
        misconfigurations,
        environment: process.env.NODE_ENV || 'unknown',
        reason: 'boot_health_check',
      },
    });
  } catch {
    // Best-effort
  }
}
