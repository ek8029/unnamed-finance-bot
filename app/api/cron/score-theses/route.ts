import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { scoreAllTheses } from '@/lib/score-theses';
import { sendBreachAlerts } from '@/lib/thesis-breach';
import { generateThesisActions } from '@/lib/thesis-actions';
import { generateInvestigations } from '@/lib/thesis-investigation';
import { generateCrossThesisRisks } from '@/lib/cross-thesis-risk';
import { rejudgeStaleMechanisms } from '@/lib/content/judge-runner';
import { entitledToMonitoring } from '@/lib/thesis-entitlement';
import { describeLedger } from '@/lib/ai/pricing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
    }
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker') ?? undefined;

    const result = await scoreAllTheses(serviceClient, ticker);

    const breachesSent = await sendBreachAlerts(serviceClient, result.breaches, result.log);

    // Pipeline composition: now that statuses are recomputed, refresh the agentic
    // outputs for every user with tracked theses. Per-user so each pure pipeline can
    // join that user's holdings / pillars. Each is independent and fail-isolated.
    let actionsGenerated = 0;
    let investigationsGenerated = 0;
    let risksGenerated = 0;
    try {
      let owners = serviceClient.from('theses').select('user_id').eq('tracked', true);
      if (ticker) owners = owners.eq('ticker', ticker);
      const { data: ownerRows } = await owners;
      const allOwners = [...new Set((ownerRows ?? []).map((r) => r.user_id as string))];

      // Same entitlement gate the scorer uses. Without it this loop ran the
      // agentic pipelines for free users too: wasted compute today because the
      // read routes still gate, and a live feature leak the moment they don't.
      const entitled = await entitledToMonitoring(serviceClient, allOwners);
      const userIds = allOwners.filter((id) => entitled.has(id));
      if (userIds.length < allOwners.length) {
        result.log.push(`[agentic] skipped ${allOwners.length - userIds.length} unentitled owner(s).`);
      }

      for (const userId of userIds) {
        const short = userId.slice(0, 8);
        try {
          actionsGenerated += (await generateThesisActions(serviceClient, userId)).generated;
        } catch (err) {
          result.log.push(`[actions] ${short} failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
        try {
          investigationsGenerated += (await generateInvestigations(serviceClient, userId)).generated;
        } catch (err) {
          result.log.push(`[investigation] ${short} failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
        try {
          risksGenerated += (await generateCrossThesisRisks(serviceClient, userId)).generated;
        } catch (err) {
          result.log.push(`[risk] ${short} failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    } catch (err) {
      result.log.push(`[agentic] generation skipped: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // Re-judge mechanism groupings whose evidence changed this run (cache-keyed
    // by finding-set hash, so quiet days cost zero calls). Capped per run —
    // anything past the cap is picked up tomorrow. Fail-isolated like the rest.
    let mechanismsJudged = 0;
    try {
      const rj = await rejudgeStaleMechanisms(serviceClient, {
        cap: 8,
        tickers: ticker ? [ticker] : undefined,
      });
      mechanismsJudged = rj.judged;
      result.log.push(`[mechanisms] judged ${rj.judged}, fresh ${rj.skippedFresh}, checked ${rj.pillarsChecked}`);
      for (const e of rj.errors) result.log.push(`[mechanisms] ${e}`);
    } catch (err) {
      result.log.push(`[mechanisms] rejudge skipped: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // The whole scoring chain writes its diagnostics into result.log and nothing else:
    // every LLM error, every dropped row and every rejected escalation. Returning it in
    // the response body means Vercel discards it, so the pipeline has been unobservable
    // in production while the user-triggered backfill path logged the same array. The
    // dropped-row lines matter most: a row killed by "excerpt not found in source" is a
    // finding the judge made and we deleted, and that failure is concentrated in filings.
    for (const line of result.log) console.log(`[cron/score-theses] ${line}`);
    const dropped = result.log.filter((l) => l.includes('Dropping row:')).length;
    console.log(
      `[cron/score-theses] scanned=${result.scanned} evidenceAdded=${result.evidenceAdded} ` +
        `statusChanges=${result.statusChanges} droppedRows=${dropped} breachesSent=${breachesSent}`,
    );
    // Every judge, escalation and memo call in this run, priced from the tokens
    // the APIs reported (lib/ai/pricing.ts). This is the hourly cost line.
    console.log(`[cron/score-theses] cost ${describeLedger(result.usage)}`);

    return NextResponse.json({
      ok: true,
      ticker: ticker ?? 'all',
      scanned: result.scanned,
      evidenceAdded: result.evidenceAdded,
      statusChanges: result.statusChanges,
      breachesSent,
      actionsGenerated,
      investigationsGenerated,
      risksGenerated,
      mechanismsJudged,
      costUsd: Number(result.usage.costUsd.toFixed(4)),
      log: result.log,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
