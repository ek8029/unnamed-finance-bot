// lib/agent/judge-run.ts
// What one judge job actually does. Kept apart from lib/agent/judge-queue.ts
// because this file imports the scorer, which constructs an OpenAI client at
// import time; the queue stays importable (and testable) without a key.
//
// A filing or news job is "scan this thesis now": the same scoreOneThesis the
// hourly cron runs, on the same window, writing pillar_evidence exactly as
// today and advancing last_scanned_at so the hour does not re-judge the same
// sources. An investigate job hands the scorer the intraday price move it was
// raised for and nothing else, keyed exactly like the daily close move so the
// two can never both be filed.

import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreOneThesis, type Candidate, type Thesis } from '@/lib/score-theses';
import { monitoredThesisIds } from '@/lib/agent/monitored';
import { getRecentFilings, BUSINESS_FORMS } from '@/lib/edgar';
import { emptyLedger } from '@/lib/ai/pricing';
import type { JudgeJobRow, JudgeJobOutcome } from '@/lib/agent/judge-queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** How many times a filing job waits for EDGAR's submissions API to list the accession. */
const FILING_LISTING_TRIES = 5;
const FILING_LISTING_WAIT_MS = 3 * 60_000;

export async function runJudgeJob(db: Db, job: JudgeJobRow, log: string[]): Promise<JudgeJobOutcome> {
  if (job.kind === 'classify') return { status: 'skipped', error: 'classify rows are ledger entries, not work' };
  if (!job.thesis_id || !job.user_id) return { status: 'skipped', error: 'no thesis on the job' };

  const { data: thesisRow, error } = await db
    .from('theses')
    .select('id, user_id, ticker, tracked, last_scanned_at')
    .eq('id', job.thesis_id)
    .maybeSingle();
  if (error) return { status: 'failed', error: `thesis lookup: ${error.message}` };
  if (!thesisRow) return { status: 'skipped', error: 'thesis deleted' };
  const thesis = thesisRow as Thesis;
  if (!thesis.tracked) return { status: 'skipped', error: 'thesis untracked' };

  // Same gate as the hourly scorer: Pro keeps every thesis, a free user keeps
  // their oldest tracked one, and an event on the others is recorded, not judged.
  const kept = await monitoredThesisIds(db, [thesis.user_id]);
  if (!kept.has(thesis.id)) return { status: 'skipped', error: 'not monitored on this tier' };

  const ledger = emptyLedger();
  let candidates: Candidate[] | undefined;

  if (job.kind === 'filing') {
    // The feed lists a filing a few minutes before data.sec.gov/submissions
    // does, and the scan reads submissions. Wait for it, bounded, so the job
    // reads the document it was raised for instead of marking itself done on
    // a scan that could not see it. The fresh read also primes the scorer's
    // one-hour filings cache.
    const accession = String(job.payload?.accession_no ?? '').replace(/-/g, '');
    const form = String(job.payload?.form ?? '');
    const isBusinessForm = BUSINESS_FORMS.some((f) => form === f || form.startsWith(f + '/'));
    if (accession && isBusinessForm) {
      const filedDate = String(job.payload?.filed_at ?? '').slice(0, 10) || undefined;
      const listed = (await getRecentFilings(thesis.ticker, filedDate, BUSINESS_FORMS, { fresh: true }))
        .some((f) => f.url.includes(accession));
      if (!listed && job.attempts < FILING_LISTING_TRIES) {
        return { status: 'deferred', error: 'accession not yet in EDGAR submissions', deferMs: FILING_LISTING_WAIT_MS };
      }
      if (!listed) log.push(`[${thesis.ticker}] ${accession} never appeared in submissions after ${job.attempts} tries; scanning the window anyway`);
    }
  }

  if (job.kind === 'investigate') {
    const p = job.payload ?? {};
    const ticker = String(p.ticker ?? thesis.ticker).toUpperCase();
    const date = String(p.date ?? '').slice(0, 10);
    const pct = Number(p.pct);
    if (!date || !Number.isFinite(pct)) return { status: 'failed', error: 'investigate job needs payload.date and payload.pct' };
    const direction = pct > 0 ? 'rose' : 'fell';
    const excerpt = `${ticker} ${direction} ${(Math.abs(pct) * 100).toFixed(1)}% on ${date}`;
    candidates = [{
      source_type: 'price_move',
      source_key: job.source_key,
      source_title: `Price move (intraday): ${excerpt}`,
      source_url: null,
      source_published_at: date,
      sourceText: excerpt,
      excerpt_override: excerpt,
    }];
  }

  const result = await scoreOneThesis(db, thesis, log, { ledger, candidates });
  return { status: 'done', ledger, evidenceAdded: result.evidenceAdded, statusChanges: result.statusChanges };
}
