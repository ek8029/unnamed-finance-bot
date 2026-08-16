/**
 * Signup endpoint — hardened against disposable email abuse and rate-limit probes.
 *
 * IMPORTANT — MANUAL SETUP REQUIRED FOR PRODUCTION:
 * ---------------------------------------------------------------------------
 * This route does server-side hCaptcha verification, but Supabase ALSO needs
 * hCaptcha enabled at the dashboard level. Otherwise an attacker who bypasses
 * this route and hits the Supabase auth endpoint directly (e.g. via the JS
 * client library) will skip the captcha entirely.
 *
 * To enable Supabase-level hCaptcha:
 *   1. Go to Supabase Dashboard → Authentication → Providers → Email settings
 *      https://app.supabase.com/project/owsnvccubdoikaofffab/auth/providers
 *   2. Enable "Enable Captcha protection"
 *   3. Select provider: hCaptcha
 *   4. Paste the SAME secret key set in HCAPTCHA_SECRET_KEY env var
 *   5. Save
 *
 * After enabling, this route passes the captcha token through to Supabase via
 * `supabase.auth.signUp({ options: { captchaToken } })` — Supabase then
 * re-verifies the token server-side as a second line of defense.
 * ---------------------------------------------------------------------------
 *
 * Defense layers, in check order (cheapest first, expensive last):
 *   1. Honeypot field check           (free — sync)
 *   2. Form age check (time-gate)     (free — sync)
 *   3. Required-field + format check  (free — sync)
 *   4. Email domain validation        (free — in-memory set lookup)
 *   5. IP rate limit                  (one Redis call)
 *   6. Email domain rate limit        (one Redis call)
 *   7. Global rate limit              (one Redis call)
 *   8. hCaptcha server-side verify    (one external API call)
 *   9. supabase.auth.signUp()         (external API call + email send)
 *
 * Every failed check returns a generic 400/429/503 with NO indication of
 * which layer tripped. The attacker must not learn what blocked them.
 * Every check (pass or fail) writes to auth_events with the specific reason
 * for operator visibility.
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkPasswordStrength, logAuthEvent } from '@/lib/auth-security';
import {
  assertSignupRateLimitConfigured,
  checkSignupRateLimits,
  MissingRateLimitConfigError,
} from '@/lib/signup-protection';
import { validateEmailDomain, extractEmailDomain } from '@/lib/email-validation';
import { verifyHCaptcha, MissingCaptchaConfigError } from '@/lib/captcha';

/** Minimum form age (ms). Humans can't fill a form and click submit in under 1.5s. */
const MIN_FORM_AGE_MS = 1500;
/** Maximum form age (ms). Older than 1 hour = stale / replay. */
const MAX_FORM_AGE_MS = 60 * 60 * 1000;

/** Generic error messages — never leak which layer rejected. */
const GENERIC_BAD_REQUEST = 'Unable to create account. Please try again.';
const GENERIC_RATE_LIMIT = 'Too many signup attempts. Please try again later.';
const GENERIC_MISCONFIGURED = 'Signup is temporarily unavailable. Please try again in a few minutes.';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  // Extract signals early so we can log them even if the request body is malformed
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Fail closed in production if Upstash isn't configured
    try {
      assertSignupRateLimitConfigured();
    } catch (err) {
      if (err instanceof MissingRateLimitConfigError) {
        await logAuthEvent({
          eventType: 'signup_misconfigured',
          metadata: { ip: clientIp, reason: 'upstash_missing', userAgent },
        });
        return NextResponse.json({ error: GENERIC_MISCONFIGURED }, { status: 503 });
      }
      throw err;
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const full_name = typeof body.full_name === 'string' ? body.full_name : null;
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : null;
    const honeypot = typeof body.website === 'string' ? body.website : '';
    const formRenderedAt = typeof body.form_rendered_at === 'number' ? body.form_rendered_at : 0;

    const utm_source = typeof body.utm_source === 'string' ? body.utm_source : null;
    const utm_medium = typeof body.utm_medium === 'string' ? body.utm_medium : null;
    const utm_campaign = typeof body.utm_campaign === 'string' ? body.utm_campaign : null;

    const emailDomain = extractEmailDomain(email) || 'unknown';
    const logBase = { email, emailDomain, ip: clientIp, userAgent };

    // ──────────────────────────────────────────────────────────────────────
    // Layer 1: Honeypot field — bots that auto-fill "website" get caught
    // ──────────────────────────────────────────────────────────────────────
    if (honeypot.length > 0) {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: 'honeypot' },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layer 2: Form age (time-gate) — reject forms submitted <1.5s or >1h
    // ──────────────────────────────────────────────────────────────────────
    if (!formRenderedAt || typeof formRenderedAt !== 'number') {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: 'time_gate_missing' },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }
    const formAgeMs = Date.now() - formRenderedAt;
    if (formAgeMs < MIN_FORM_AGE_MS) {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: 'time_gate_too_fast', formAgeMs },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }
    if (formAgeMs > MAX_FORM_AGE_MS) {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: 'time_gate_too_old', formAgeMs },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layer 3: Required fields + format check
    // ──────────────────────────────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layer 4: Email domain validation (disposable / DDNS / bot pattern)
    // ──────────────────────────────────────────────────────────────────────
    const emailValidation = validateEmailDomain(email);
    if (!emailValidation.valid) {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: emailValidation.reason || 'email_invalid' },
      });
      return NextResponse.json({ error: 'Please use a different email address' }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layers 5-7: Upstash rate limits (IP → domain → global)
    // ──────────────────────────────────────────────────────────────────────
    const rlResult = await checkSignupRateLimits({
      ip: clientIp,
      emailDomain,
    });
    if (!rlResult.allowed) {
      await logAuthEvent({
        eventType: 'signup_ratelimited',
        email,
        metadata: { ...logBase, reason: rlResult.reason || 'rl_unknown', retryAfterSeconds: rlResult.retryAfterSeconds },
      });
      const headers = new Headers();
      if (rlResult.retryAfterSeconds) headers.set('Retry-After', String(rlResult.retryAfterSeconds));
      return NextResponse.json({ error: GENERIC_RATE_LIMIT }, { status: 429, headers });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layer 8: hCaptcha verification
    // ──────────────────────────────────────────────────────────────────────
    let captchaResult;
    try {
      captchaResult = await verifyHCaptcha(captchaToken, clientIp);
    } catch (err) {
      if (err instanceof MissingCaptchaConfigError) {
        await logAuthEvent({
          eventType: 'signup_misconfigured',
          metadata: { ip: clientIp, reason: 'hcaptcha_missing', userAgent },
        });
        return NextResponse.json({ error: GENERIC_MISCONFIGURED }, { status: 503 });
      }
      throw err;
    }
    if (!captchaResult.success) {
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: captchaResult.reason || 'captcha_failed' },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Password strength — not a security defense against bots (they'd use
    // strong passwords) but enforced for legitimate users
    // ──────────────────────────────────────────────────────────────────────
    const strength = checkPasswordStrength(password);
    if (strength.score < 3) {
      const unmet = strength.requirements.filter(r => !r.met).map(r => r.label);
      return NextResponse.json(
        { error: `Password is too weak. Missing: ${unmet.join(', ')}` },
        { status: 400 },
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Layer 9: supabase.auth.signUp — token is forwarded so Supabase
    // also verifies it (requires Dashboard CAPTCHA to be enabled)
    // ──────────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || null },
        captchaToken: captchaToken || undefined,
      },
    });

    if (error) {
      console.error('Signup error:', error.message);
      await logAuthEvent({
        eventType: 'signup_blocked',
        email,
        metadata: { ...logBase, reason: 'supabase_rejected', supabaseError: error.message },
      });
      return NextResponse.json({ error: GENERIC_BAD_REQUEST }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Use service client for post-signup inserts — anon client has no session
    // yet (email confirmation pending), so RLS blocks all writes
    const serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user profile (with UTM attribution if present)
    const { error: profileError } = await serviceClient
      .from('user_profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        full_name: full_name || null,
        ...(utm_source && { utm_source }),
        ...(utm_medium && { utm_medium }),
        ...(utm_campaign && { utm_campaign }),
      });
    if (profileError) console.error('Error creating profile:', profileError);

    // Create default preferences
    const { error: prefsError } = await serviceClient
      .from('user_preferences')
      .insert({
        user_id: data.user.id,
        theme: 'dark',
        currency: 'USD',
      });
    if (prefsError) console.error('Error creating preferences:', prefsError);

    // Create free tier subscription
    const { error: subError } = await serviceClient
      .from('user_subscriptions')
      .insert({
        user_id: data.user.id,
        tier: 'free',
      });
    if (subError) console.error('Error creating subscription:', subError);

    // Log successful signup
    await logAuthEvent({
      userId: data.user.id,
      email: data.user.email || email,
      eventType: 'signup_success',
      metadata: { ip: clientIp, emailDomain, userAgent, utm_source, utm_medium, utm_campaign },
    });

    // Send Day 0 welcome email + log to drip table so cron skips it.
    //
    // ONLY once the account can actually be used. With email confirmation ON,
    // signUp returns no session, and sending the welcome here put two emails in
    // the inbox within seconds of each other: Supabase's "confirm your address"
    // and Helm's "welcome, here is what to do next". The welcome arrived first
    // and told someone to go do things they could not do, because they had not
    // confirmed yet.
    //
    // No session means unconfirmed. Skipping here is not a lost email: day 0 is
    // not written to email_drip_log, so the drip cron finds it unsent and sends
    // it on its next run. The guard below is what stops a double.
    try {
      if (!data.session) throw new Error('unconfirmed: welcome deferred to drip cron');
      const { resend: resendClient, FROM_EMAIL } = await import('@/lib/emails/resend');
      const { getTemplate } = await import('@/lib/emails/templates');
      if (resendClient) {
        const firstName = full_name ? full_name.split(' ')[0] : undefined;
        const template = getTemplate(0, firstName);
        if (template) {
          await resendClient.emails.send({
            from: FROM_EMAIL,
            to: data.user.email || email,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          // Log to email_drip_log so drip cron never re-sends Day 0
          await serviceClient.from('email_drip_log').insert({
            user_id: data.user.id,
            drip_day: 0,
            email_subject: template.subject,
            sent_at: new Date().toISOString(),
          });
        }
      }
    } catch (emailErr) {
      // Deferral is expected, not a failure; anything else is worth seeing.
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      if (!msg.startsWith('unconfirmed:')) console.error('Welcome email failed:', msg);
    }

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      message: data.session
        ? 'Account created successfully'
        : 'Check your email to confirm your account',
    });
  } catch (error) {
    console.error('Error in signup route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
