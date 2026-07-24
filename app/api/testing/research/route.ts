// Dev-only research engine endpoint. Takes an account email plus a question,
// resolves the account with the service client (same pattern as the other
// /testing surfaces), retrieves the agent's real findings + book + market data,
// and returns a grounded answer. 404s in production — it reads arbitrary
// accounts by design, so it must never exist on the public deployment.

import { NextRequest, NextResponse } from 'next/server';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { retrieveContext } from '@/lib/research/retrieve';
import { getRecentFindings } from '@/lib/research/findings';
import { getPortfolioBrief, getValueLedger } from '@/lib/research/account';
import { computeStanding } from '@/lib/research/standing';
import { composeAnswer, type ConversationTurn } from '@/lib/research/compose';

export const dynamic = 'force-dynamic';

async function resolveUserId(email: string): Promise<string | null> {
  const db = createStaticServiceClient();
  const { data } = await db.from('user_profiles').select('id').eq('email', email).maybeSingle();
  return data ? String(data.id) : null;
}

// The browsable "what Helm found" feed: recent findings across the whole book,
// with no question asked yet.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const userId = await resolveUserId(email);
  if (!userId) return NextResponse.json({ error: `No account for ${email}` }, { status: 404 });

  const db = createStaticServiceClient();
  const brief = await getPortfolioBrief(db, userId);
  const [findings, ledger] = await Promise.all([
    getRecentFindings(db, userId),
    getValueLedger(db, userId, brief),
  ]);
  const standing = computeStanding(brief, findings, ledger);
  return NextResponse.json({ findings, ledger, standing });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json()) as {
    email?: string;
    query?: string;
    history?: ConversationTurn[];
  };
  const email = body.email?.trim().toLowerCase();
  const query = body.query?.trim();

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });
  if (query.length > 500) return NextResponse.json({ error: 'query too long' }, { status: 400 });

  const db = createStaticServiceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: `No account for ${email}` }, { status: 404 });

  try {
    const context = await retrieveContext(db, String(profile.id), query);
    const answer = await composeAnswer(context, Array.isArray(body.history) ? body.history : []);
    return NextResponse.json({
      answer,
      retrieval: {
        tickers: context.tickers,
        topics: context.topics,
        findingCount: context.findings.length,
        findingKinds: context.findings.map((f) => f.kind),
        hasPortfolio: !!context.portfolio,
        hasMarketData: !!context.marketData,
      },
    });
  } catch (err) {
    console.error('research engine failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Composition failed' }, { status: 500 });
  }
}
