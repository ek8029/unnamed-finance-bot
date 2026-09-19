import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { AI_CONSENT_VERSION, readAiConsent } from '@/lib/ai-consent';

export const dynamic = 'force-dynamic';
const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE });
    // Always read the current choice; do not infer permission from a paid tier.
    return NextResponse.json(await readAiConsent(db, user.id), { headers: PRIVATE });
  } catch {
    return NextResponse.json({ error: 'Could not read AI permission. Try again.' }, { status: 503, headers: PRIVATE });
  }
}

export async function POST(request: Request) {
  try {
    // The browser may only update this state from Helm's own origin. Bearer
    // clients do not rely on cookies and are authenticated independently below.
    const origin = request.headers.get('origin');
    if (!request.headers.get('authorization')?.startsWith('Bearer ') && origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: PRIVATE });
    }
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE });
    const body = await request.json().catch(() => null);
    if (typeof body?.granted !== 'boolean' || body.version !== AI_CONSENT_VERSION) {
      return NextResponse.json({ error: 'Read the current AI disclosure and choose Allow or Pause.', version: AI_CONSENT_VERSION }, { status: 400, headers: PRIVATE });
    }
    const service = await createServiceClient();
    const now = new Date().toISOString();
    const { error: writeError } = await service.from('user_ai_consents').upsert({
      user_id: user.id,
      version: AI_CONSENT_VERSION,
      granted_at: body.granted ? now : null,
      revoked_at: body.granted ? null : now,
      updated_at: now,
    }, { onConflict: 'user_id' });
    if (writeError) throw writeError;
    return NextResponse.json({ granted: body.granted, version: AI_CONSENT_VERSION, grantedAt: body.granted ? now : null, revokedAt: body.granted ? null : now }, { headers: PRIVATE });
  } catch {
    return NextResponse.json({ error: 'Could not save AI permission. Your choice has not changed.' }, { status: 503, headers: PRIVATE });
  }
}
