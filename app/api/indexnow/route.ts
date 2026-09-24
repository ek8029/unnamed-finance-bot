import { NextRequest, NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/indexnow';

/**
 * POST /api/indexnow
 * Pings Bing/Yandex IndexNow API to notify about new/updated URLs.
 * Body: { urls: string[] }
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[indexnow] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.INDEXNOW_KEY) {
    console.error('[indexnow] INDEXNOW_KEY not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const body = await request.json();
  const urls: string[] = body.urls ?? [];

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
  }

  // One implementation, shared with the admin actions: same payload, same
  // endpoint fallback, same key handling.
  const out = await submitToIndexNow(urls);
  if (out.error && out.status === undefined) {
    return NextResponse.json({ error: out.error }, { status: 500 });
  }
  return NextResponse.json({
    submitted: urls.length,
    status: out.status,
    ok: out.ok,
    endpoint: out.endpoint,
  });
}
