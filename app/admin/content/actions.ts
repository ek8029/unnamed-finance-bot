'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { submitToIndexNow } from '@/lib/indexnow';

async function requireAllowlisted(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isThesisUser(user?.email)) {
    throw new Error('Forbidden');
  }
}

async function decide(id: string, status: 'approved' | 'rejected'): Promise<void> {
  await requireAllowlisted();
  const db = await createServiceClient();
  await db
    .from('content_queue')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/admin/content');
}

export async function approveDraft(id: string): Promise<void> {
  await requireAllowlisted();
  const db = await createServiceClient();
  // Grab the affected ticker so we can revalidate + notify the exact public surfaces.
  const { data: row } = await db
    .from('content_queue')
    .select('content_events(ticker)')
    .eq('id', id)
    .maybeSingle();
  await db
    .from('content_queue')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/admin/content');
  revalidatePath('/masthead');
  const ticker = (row?.content_events as { ticker?: string } | null)?.ticker;
  if (ticker) {
    const slug = ticker.toLowerCase();
    // Refresh the ISR pages now instead of waiting out the revalidate window...
    revalidatePath(`/thesis/${slug}`);
    revalidatePath(`/thesis-risks/${slug}`);
    revalidatePath(`/when-to-sell/${slug}`);
    // ...and tell Bing/IndexNow so answer engines see the fresh evidence in minutes.
    void submitToIndexNow([`/thesis/${slug}`, '/masthead', `/thesis-risks/${slug}`, `/when-to-sell/${slug}`]);
  }
}

export async function rejectDraft(id: string): Promise<void> {
  await decide(id, 'rejected');
}
