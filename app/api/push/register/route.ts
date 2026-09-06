// POST /api/push/register { token, platform, appVersion }: this device wants to be told.
// DELETE /api/push/register { token }: it does not any more (sign out, account deletion).
//
// Identity comes from the Bearer session the app already sends. The write runs
// as the service role so a phone that changes accounts moves its token to the
// new account instead of failing the row-level policy on the old one.

import { NextResponse } from 'next/server';
import { createClient, createStaticServiceClient } from '@/lib/supabase/server';
import { isExpoPushToken } from '@/lib/push/expo';

export const dynamic = 'force-dynamic';

async function who(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const userId = await who();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; platform?: unknown; appVersion?: unknown };
  if (!isExpoPushToken(body.token)) return NextResponse.json({ error: 'Not an Expo push token' }, { status: 400 });
  const platform = body.platform === 'android' ? 'android' : 'ios';
  const now = new Date().toISOString();
  const db = createStaticServiceClient();
  const { error } = await db
    .from('push_tokens')
    .upsert({
      user_id: userId,
      token: body.token,
      platform,
      app_version: typeof body.appVersion === 'string' ? body.appVersion.slice(0, 40) : null,
      last_seen_at: now,
      disabled_at: null,
      disabled_reason: null,
    }, { onConflict: 'token' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await who();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  if (!isExpoPushToken(body.token)) return NextResponse.json({ error: 'Not an Expo push token' }, { status: 400 });
  const db = createStaticServiceClient();
  const { error } = await db
    .from('push_tokens')
    .update({ disabled_at: new Date().toISOString(), disabled_reason: 'signed out' })
    .eq('token', body.token)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
