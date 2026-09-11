import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readActivationState } from '@/lib/activation-state';
import { isDemoAccount } from '@/lib/onboarding/demo-account';

export async function GET() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // userId lets a client scope per-account browser state (the onboarding v3
    // deferral) without plumbing the session through props. It is the caller's
    // own id, already in their session. isDemo is resolved here rather than in
    // the browser so the address never has to reach the client bundle.
    return NextResponse.json({
      ...await readActivationState(client, user.id),
      userId: user.id,
      isDemo: isDemoAccount(user.email),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load your saved progress' }, { status: 503 });
  }
}
