import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, source } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from('pro_waitlist')
      .select('id')
      .eq('email', trimmed)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ already_registered: true });
    }

    const { error: insertError } = await supabase
      .from('pro_waitlist')
      .insert({
        email: trimmed,
        user_id: user?.id || null,
        source: source || 'pricing',
      });

    if (insertError) {
      console.error('[pro-waitlist] Insert failed:', insertError);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
