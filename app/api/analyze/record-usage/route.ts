import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAnalysisUsage, checkAnalysisQuota } from '@/lib/tier';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await recordAnalysisUsage(user.id);
  const quota = await checkAnalysisQuota(user.id);

  return NextResponse.json({ quota }, {
    headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
  });
}
