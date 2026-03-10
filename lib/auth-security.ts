import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

// ── Password Strength ──────────────────────────────────────────────

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  requirements: { label: string; met: boolean }[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const score = Math.min(4, metCount) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return { score, label: labels[score], requirements };
}

// ── Rate Limiting ──────────────────────────────────────────────────

export async function checkRateLimit(
  identifier: string,
  eventType: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds?: number }> {
  const supabase = await createServiceClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('auth_events')
    .select('*', { count: 'exact', head: true })
    .eq('email', identifier)
    .eq('event_type', eventType)
    .gte('created_at', windowStart);

  const attempts = count || 0;
  const remaining = Math.max(0, maxAttempts - attempts);

  if (attempts >= maxAttempts) {
    const { data: oldest } = await supabase
      .from('auth_events')
      .select('created_at')
      .eq('email', identifier)
      .eq('event_type', eventType)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: true })
      .limit(1);

    const retryAfterSeconds = oldest?.[0]
      ? Math.ceil(
          (new Date(oldest[0].created_at).getTime() + windowMinutes * 60 * 1000 - Date.now()) / 1000,
        )
      : windowMinutes * 60;

    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(0, retryAfterSeconds) };
  }

  return { allowed: true, remaining };
}

// ── Auth Event Logging ─────────────────────────────────────────────

export async function logAuthEvent(params: {
  userId?: string;
  email?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createServiceClient();
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    await supabase.from('auth_events').insert({
      user_id: params.userId || null,
      email: params.email || null,
      event_type: params.eventType,
      ip_address: ip,
      user_agent: userAgent,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Non-fatal - never break the auth flow for logging
    console.error('Failed to log auth event:', err);
  }
}

// ── User Agent Parsing ─────────────────────────────────────────────

export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';

  return { browser, os, device };
}
