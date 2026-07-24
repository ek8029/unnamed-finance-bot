// Record a realized value event: the user saying "I actually executed this"
// (e.g. harvested a loss Helm surfaced), with the dollar amount they realized.
// User-owned rows under RLS (migration 059); this endpoint just validates.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KINDS = new Set(['tlh_harvest', 'other']);
const MAX_AMOUNT = 10_000_000; // sanity ceiling, not a business rule

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { kind?: string; amount?: number; ticker?: string; note?: string };
  const kind = String(body.kind ?? '');
  const amount = Number(body.amount);
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  const ticker = body.ticker ? String(body.ticker).toUpperCase().slice(0, 8) : null;
  const note = body.note ? String(body.note).slice(0, 200) : null;

  const { data, error: insertError } = await supabase
    .from('value_events')
    .insert({ user_id: user.id, kind, amount, ticker, note })
    .select('id')
    .maybeSingle();
  if (insertError) {
    // 42P01 = migration 059 not applied yet
    const status = insertError.code === '42P01' ? 503 : 500;
    return NextResponse.json({ error: 'Could not record' }, { status });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // RLS scopes the delete to the user's own rows.
  await supabase.from('value_events').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
