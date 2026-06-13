import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nextLifecycle, type Lifecycle } from '@/lib/thesis-lifecycle';

const VALID_STATUS_OVERRIDES = new Set(['unverified', 'intact', 'weakening', 'broken']);

// PATCH /api/thesis/pillars/[id] — update pillar fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: pillar, error: fetchError } = await supabase
      .from('thesis_pillars')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[thesis/pillars] PATCH fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pillar) {
      return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
    }

    if (pillar.lifecycle === 'dismissed') {
      return NextResponse.json({ error: 'Dismissed pillars cannot be modified' }, { status: 409 });
    }

    const body = await request.json() as Record<string, unknown>;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('lifecycle' in body || 'lifecycle_at' in body) {
      return NextResponse.json({ error: 'lifecycle is derived and cannot be set directly' }, { status: 400 });
    }

    // claim — non-empty trimmed string
    if ('claim' in body) {
      if (typeof body.claim !== 'string' || body.claim.trim().length === 0) {
        return NextResponse.json({ error: 'claim must be a non-empty string' }, { status: 400 });
      }
      updates.claim = body.claim.trim();
    }

    // confirmed — boolean
    if ('confirmed' in body) {
      if (typeof body.confirmed !== 'boolean') {
        return NextResponse.json({ error: 'confirmed must be a boolean' }, { status: 400 });
      }
      updates.confirmed = body.confirmed;
    }

    // sort_order — integer
    if ('sort_order' in body) {
      if (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order)) {
        return NextResponse.json({ error: 'sort_order must be an integer' }, { status: 400 });
      }
      updates.sort_order = body.sort_order;
    }

    // status_override — one of enum values or null to clear
    if ('status_override' in body) {
      const so = body.status_override;
      if (so !== null && (typeof so !== 'string' || !VALID_STATUS_OVERRIDES.has(so))) {
        return NextResponse.json(
          { error: "status_override must be 'unverified', 'intact', 'weakening', 'broken', or null" },
          { status: 400 },
        );
      }
      updates.status_override = so ?? null;
      updates.status_changed_at = new Date().toISOString();
    }

    // lifecycle -- derived, never client-settable
    const transition = nextLifecycle(pillar.lifecycle as Lifecycle, {
      confirmed: typeof body.confirmed === 'boolean' ? body.confirmed : undefined,
      claimChanged: typeof updates.claim === 'string' && updates.claim !== pillar.claim,
    });
    if (transition) {
      updates.lifecycle = transition;
      updates.lifecycle_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from('thesis_pillars')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[thesis/pillars] PATCH update error:', updateError);
      return NextResponse.json({ error: 'Failed to update pillar' }, { status: 500 });
    }

    return NextResponse.json({ pillar: updated });
  } catch (err) {
    console.error('[thesis/pillars] PATCH unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/thesis/pillars/[id] — delete pillar (evidence cascades via FK)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: pillar, error: fetchError } = await supabase
      .from('thesis_pillars')
      .select('id, origin, confirmed')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[thesis/pillars] DELETE fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pillar) {
      return NextResponse.json({ error: 'Pillar not found' }, { status: 404 });
    }

    // Unconfirmed AI drafts are soft-dismissed: the rejection is a learning signal.
    if (pillar.origin === 'ai_draft' && !pillar.confirmed) {
      const { error: dismissError } = await supabase
        .from('thesis_pillars')
        .update({ lifecycle: 'dismissed', lifecycle_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
      if (dismissError) {
        console.error('[thesis/pillars] DELETE dismiss error:', dismissError);
        return NextResponse.json({ error: 'Failed to dismiss pillar' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, dismissed: true });
    }

    const { error: deleteError } = await supabase
      .from('thesis_pillars')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[thesis/pillars] DELETE error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete pillar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[thesis/pillars] DELETE unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
