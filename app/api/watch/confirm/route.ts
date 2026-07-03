import { NextResponse } from 'next/server';
import { confirmWatch } from '@/lib/watch';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const ok = await confirmWatch(token);
  const dest = ok ? '/watch/confirmed' : '/watch/confirmed?error=1';
  return NextResponse.redirect(new URL(dest, request.url));
}
