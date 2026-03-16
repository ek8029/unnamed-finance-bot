import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWrapped } from '@/lib/portfolio-wrapped';
import { requirePro } from '@/lib/tier';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed } = await requirePro(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Portfolio Wrapped is a Pro feature.', code: 'PRO_REQUIRED' },
      { status: 403 },
    );
  }

  const period = request.nextUrl.searchParams.get('period') === 'year' ? 'year' : 'quarter';

  try {
    const wrapped = await generateWrapped(user.id, period);
    return NextResponse.json(wrapped);
  } catch (error) {
    console.error('Wrapped generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate wrapped' }, { status: 500 });
  }
}
