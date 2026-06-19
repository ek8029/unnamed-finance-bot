'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';

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
  await decide(id, 'approved');
}

export async function rejectDraft(id: string): Promise<void> {
  await decide(id, 'rejected');
}
