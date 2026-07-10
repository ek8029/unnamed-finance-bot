// GET /api/emails/unsubscribe?u=<userId>&k=<kind>&t=<sig>
// One-click, no-login opt-out reached from an email footer (and the
// List-Unsubscribe header). Verifies the HMAC signature, then flips the matching
// preference(s) to false. Returns a small confirmation page either way.
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyUnsub, type UnsubKind } from '@/lib/emails/unsubscribe';

export const dynamic = 'force-dynamic';

const KIND_FIELDS: Record<UnsubKind, Record<string, boolean>> = {
  brief: { notification_daily_brief: false },
  market: { notification_market_alerts: false },
  weekly: { notification_weekly_update: false },
  all: { notification_daily_brief: false, notification_market_alerts: false, notification_weekly_update: false, notification_email: false },
};

const LABEL: Record<UnsubKind, string> = {
  brief: 'the daily brief',
  market: 'watchlist alerts',
  weekly: 'the weekly update',
  all: 'all emails',
};

function page(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#FAFAFA;">
<div style="max-width:440px;margin:14vh auto 0;padding:0 24px;text-align:center;">
<p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E6B94D;font-family:monospace;">Helm Terminal</p>
<h1 style="font-size:22px;font-weight:700;margin:14px 0 10px;">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#8F8F8F;">${body}</p>
<a href="https://helmterminal.dev/dashboard/settings#notifications" style="display:inline-block;margin-top:22px;font-size:13px;color:#E6B94D;text-decoration:none;">Manage all notifications &rarr;</a>
</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('u') ?? '';
  const kind = (searchParams.get('k') ?? 'brief') as UnsubKind;
  const token = searchParams.get('t') ?? '';

  if (!userId || !KIND_FIELDS[kind] || !verifyUnsub(userId, kind, token)) {
    return page('Link not valid', 'This unsubscribe link is invalid or expired. You can manage every notification from your settings.');
  }

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, ...KIND_FIELDS[kind], updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      console.error('[unsubscribe] upsert failed:', error.message);
      return page('Something went wrong', 'We could not update your preferences just now. Please try again from your settings.');
    }
  } catch (err) {
    console.error('[unsubscribe] error:', err instanceof Error ? err.message : err);
    return page('Something went wrong', 'We could not update your preferences just now. Please try again from your settings.');
  }

  return page('You are unsubscribed', `You will no longer receive ${LABEL[kind]}. You can turn it back on anytime from your settings.`);
}
