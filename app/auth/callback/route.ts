import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Supabase auth callback handler.
 *
 * Handles PKCE code exchange for:
 * - Password reset links
 * - Email confirmation links
 * - Magic link sign-ins
 * - Google OAuth sign-ins (new + returning)
 *
 * For NEW OAuth users (no email_drip_log entry), we:
 * - Create user_preferences + user_subscriptions (signup route normally does this)
 * - Send Day 0 welcome email
 * - Log to email_drip_log so drip cron skips Day 0
 */
function sanitizeRedirect(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (next.includes('://')) return '/dashboard';
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = sanitizeRedirect(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this is a new user who needs onboarding records + welcome email
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const serviceClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );

          // Check if Day 0 welcome already sent (email signup users have this)
          const { data: existingDrip } = await serviceClient
            .from('email_drip_log')
            .select('id')
            .eq('user_id', user.id)
            .eq('drip_day', 0)
            .maybeSingle();

          if (!existingDrip) {
            // New OAuth user — create missing records
            await Promise.allSettled([
              serviceClient.from('user_profiles').upsert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || null,
              }, { onConflict: 'id' }),
              serviceClient.from('user_preferences').upsert({
                user_id: user.id,
                theme: 'dark',
                currency: 'USD',
              }, { onConflict: 'user_id' }),
              serviceClient.from('user_subscriptions').upsert({
                user_id: user.id,
                tier: 'free',
              }, { onConflict: 'user_id' }),
            ]);

            // Send Day 0 welcome email
            const { resend, FROM_EMAIL } = await import('@/lib/emails/resend');
            const { getTemplate } = await import('@/lib/emails/templates');
            if (resend && user.email) {
              const firstName = user.user_metadata?.full_name?.split(' ')[0] || undefined;
              const template = getTemplate(0, firstName);
              if (template) {
                await resend.emails.send({
                  from: FROM_EMAIL,
                  to: user.email,
                  subject: template.subject,
                  html: template.html,
                  text: template.text,
                });
              }
            }

            // Log Day 0 so drip cron skips it
            await serviceClient.from('email_drip_log').insert({
              user_id: user.id,
              drip_day: 0,
              email_subject: 'Welcome to Helm',
              sent_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        // Non-blocking — don't break the auth flow for email failures
        console.error('OAuth onboarding error:', err);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('Auth callback code exchange failed:', error.message);
  }

  // Code exchange failed or no code — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
