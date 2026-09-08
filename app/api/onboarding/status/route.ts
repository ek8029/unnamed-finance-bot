import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readActivationState } from '@/lib/activation-state';

export async function GET() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await readActivationState(client, user.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load your saved progress' }, { status: 503 });
  }
}
