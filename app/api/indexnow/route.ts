import { NextRequest, NextResponse } from 'next/server';

const HOST = 'https://helmterminal.dev';

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

  const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
  if (!INDEXNOW_KEY) {
    console.error('[indexnow] INDEXNOW_KEY not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const body = await request.json();
  const urls: string[] = body.urls ?? [];

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'helmterminal.dev',
        key: INDEXNOW_KEY,
        keyLocation: `${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls.map(u => u.startsWith('http') ? u : `${HOST}${u}`),
      }),
    });

    return NextResponse.json({
      submitted: urls.length,
      status: res.status,
      ok: res.ok,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'IndexNow request failed' },
      { status: 500 },
    );
  }
}
