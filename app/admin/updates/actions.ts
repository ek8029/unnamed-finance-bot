'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { submitToIndexNow } from '@/lib/indexnow';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isThesisUser(user?.email)) throw new Error('Unauthorized');
}

export interface SaveInput {
  week_of: string;
  title: string;
  intro: string;
  body_helm: string;
  body_market: string;
}

export async function saveUpdate(input: SaveInput): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  if (!input.week_of || !input.title.trim()) return { ok: false, error: 'week_of and title are required' };
  const db = await createServiceClient();
  const { error } = await db.from('weekly_updates').upsert(
    {
      week_of: input.week_of,
      title: input.title.trim(),
      intro: input.intro.trim(),
      body_helm: input.body_helm,
      body_market: input.body_market.trim() ? input.body_market : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'week_of' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/updates');
  return { ok: true };
}

export async function setPublished(week_of: string, publish: boolean): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const db = await createServiceClient();
  const { error } = await db
    .from('weekly_updates')
    .update({
      status: publish ? 'published' : 'draft',
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('week_of', week_of);
  if (error) return { ok: false, error: error.message };
  if (publish) {
    // fire-and-forget; never throws
    void submitToIndexNow([
      'https://helmterminal.dev/this-week',
      `https://helmterminal.dev/this-week/${week_of}`,
    ]);
  }
  revalidatePath('/admin/updates');
  revalidatePath('/this-week');
  revalidatePath(`/this-week/${week_of}`);
  revalidatePath('/masthead');
  return { ok: true };
}

export async function deleteUpdate(week_of: string): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const db = await createServiceClient();
  const { error } = await db.from('weekly_updates').delete().eq('week_of', week_of);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/updates');
  revalidatePath('/this-week');
  revalidatePath(`/this-week/${week_of}`);
  revalidatePath('/masthead');
  return { ok: true };
}
