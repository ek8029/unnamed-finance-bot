// Watch / unwatch a grounded question (migration 061). User-owned rows under
// RLS; the cron does the re-running, this endpoint just validates and caps.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_STANDING_QUESTIONS } from '@/lib/research/standing-questions';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { question?: string };
  const question = String(body.question ?? '').trim().slice(0, 300);
  if (question.length < 8) return NextResponse.json({ error: 'Invalid question' }, { status: 400 });

  const { count } = await supabase
    .from('standing_questions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true);
  if ((count ?? 0) >= MAX_STANDING_QUESTIONS) {
    return NextResponse.json({ error: `Limit of ${MAX_STANDING_QUESTIONS} watched questions` }, { status: 400 });
  }

  const { data, error: insertError } = await supabase
    .from('standing_questions')
    .insert({ user_id: user.id, question })
    .select('id')
    .maybeSingle();
  if (insertError) {
    // 42P01 = migration 061 not applied yet
    const status = insertError.code === '42P01' ? 503 : 500;
    return NextResponse.json({ error: 'Could not save' }, { status });
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
  await supabase.from('standing_questions').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
