import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_KEY = 'f5faae6f4dba980a7b2a4f8daa5076ca';
const HOST = 'https://helmterminal.dev';

/**
 * POST /api/indexnow
 * Pings Bing/Yandex IndexNow API to notify about new/updated URLs.
 * Body: { urls: string[] }
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
