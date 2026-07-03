import { NextResponse } from 'next/server';
import { unsubscribeWatch } from '@/lib/watch';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const ok = await unsubscribeWatch(token);
  return NextResponse.redirect(new URL(ok ? '/watch/unsubscribed' : '/watch/unsubscribed?error=1', request.url));
}
