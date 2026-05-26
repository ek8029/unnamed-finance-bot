import { NextResponse } from 'next/server';
import { runDigestCron } from '@/lib/digest-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/digest
 *
 * Thin HTTP wrapper around runDigestCron().
 * Daily cron calls runDigestCron() directly — this endpoint
 * exists for manual testing via curl.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forceAll = new URL(request.url).searchParams.get('force') === 'true';
    const result = await runDigestCron({ force: forceAll });

    return NextResponse.json({
      success: true,
      ...result,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[cron/digest] Fatal error:', error);
    return NextResponse.json({ error: 'Digest cron failed' }, { status: 500 });
  }
}
