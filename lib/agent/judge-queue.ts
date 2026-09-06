// lib/agent/judge-queue.ts
// The judge queue (perpetual watch, section 5).
//
// A poller that sees a filing, a news item or a price shock on a held name
// does not call a model. It enqueues a job here: one row per (kind, user,
// source), idempotent, with the tokens and cost written back when the job
// finishes. A minute cron drains the queue sequentially, under a daily cap, a
// per-user cap and a kill switch.
//
// The decisions (what to claim, what to cap, which day it is) are pure
// functions of plain rows so tests can pin them without a database. The
// database calls below are thin wrappers around those decisions. This module
// deliberately does not import the scorer: the worker route hands in the
// function that runs a job, so the queue can be tested without an OpenAI key.

import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyLedger, mergeLedger, type UsageLedger } from '@/lib/ai/pricing';
import { beat } from '@/lib/agent/heartbeat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type JudgeJobKind = 'filing' | 'news' | 'investigate' | 'classify';
export type JudgeJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'capped' | 'skipped';

export interface JudgeJobRow {
  id: string;
  kind: JudgeJobKind;
  user_id: string | null;
  thesis_id: string | null;
  pillar_id: string | null;
  ticker: string | null;
  source_key: string;
  payload: Record<string, unknown>;
  status: JudgeJobStatus;
  attempts: number;
  run_after: string;
  created_at: string;
  started_at?: string | null;
}

export interface NewJudgeJob {
  kind: Exclude<JudgeJobKind, 'classify'>;
  user_id: string;
  thesis_id: string;
  ticker: string;
  /** What raised the job: a filing accession, a news url, `price:{ticker}:{date}`. */
  source_key: string;
  payload?: Record<string, unknown>;
  pillar_id?: string | null;
}

export interface JudgeConfig {
  /** Kill switch. Only the literal string 'true' in JUDGE_ENABLED turns the worker on. */
  enabled: boolean;
  /** Jobs run per ET day across every user. */
  dailyCap: number;
  /** Jobs run per ET day per user, so one large book cannot starve the rest. */
  userCap: number;
  /** Jobs claimed per worker invocation. */
  batch: number;
  /** Dollars the worker may spend per ET day (judge_jobs.cost_usd, classifier rows included).
   *  The job caps bound work; this bounds the bill. Overshoot is at most one batch. */
  dailyUsd: number;
}

const DEFAULTS: JudgeConfig = { enabled: false, dailyCap: 200, userCap: 25, batch: 10, dailyUsd: 5 };

export function readJudgeConfig(env: Record<string, string | undefined> = process.env): JudgeConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
  };
  const usd = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled: env.JUDGE_ENABLED === 'true',
    dailyCap: num(env.JUDGE_DAILY_CAP, DEFAULTS.dailyCap),
    userCap: num(env.JUDGE_USER_CAP, DEFAULTS.userCap),
    batch: num(env.JUDGE_BATCH, DEFAULTS.batch),
    dailyUsd: usd(env.JUDGE_DAILY_USD, DEFAULTS.dailyUsd),
  };
}

const ET = 'America/New_York';

/**
 * Midnight in New York for the ET day containing `now`, as an ISO instant.
 * The caps are per ET day because that is the day the market and the brief
 * live in; a UTC day would roll over at 8pm in the evening.
 */
export function etDayStartIso(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: ET }).format(now); // YYYY-MM-DD
  // Midnight ET is 05:00Z in standard time and 04:00Z in daylight time. Try
  // the standard guess and read the ET hour back off it.
  const std = new Date(`${day}T05:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', hour12: false }).format(std)) % 24;
  return (hour === 0 ? std : new Date(std.getTime() - 3_600_000)).toISOString();
}

export interface TodayCounts {
  /** Jobs run (done or running) since midnight ET, classify rows excluded. */
  total: number;
  byUser: Map<string, number>;
}

export interface ClaimDecision {
  claim: JudgeJobRow[];
  capped: { job: JudgeJobRow; reason: string }[];
}

/**
 * Which queued jobs run now. Oldest first; a job past the daily cap or its
 * user's cap is marked capped rather than left queued, so the cap is visible
 * on the row and the queue cannot silently grow behind it. The hourly re-score
 * still covers those sources tomorrow.
 */
export function decideClaims(queued: JudgeJobRow[], today: TodayCounts, cfg: JudgeConfig): ClaimDecision {
  const claim: JudgeJobRow[] = [];
  const capped: ClaimDecision['capped'] = [];
  let total = today.total;
  const byUser = new Map(today.byUser);
  const ordered = [...queued].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  for (const job of ordered) {
    if (claim.length >= cfg.batch) break;
    if (total >= cfg.dailyCap) {
      capped.push({ job, reason: `daily cap ${cfg.dailyCap}` });
      continue;
    }
    const uid = job.user_id ?? '';
    const used = byUser.get(uid) ?? 0;
    if (used >= cfg.userCap) {
      capped.push({ job, reason: `user cap ${cfg.userCap}` });
      continue;
    }
    claim.push(job);
    total += 1;
    byUser.set(uid, used + 1);
  }
  return { claim, capped };
}

/**
 * Enqueue, ignoring duplicates on (kind, user_id, source_key). Returns how many
 * rows were actually new; the pollers use that number for their log line.
 */
export async function enqueueJudgeJobs(db: Db, jobs: NewJudgeJob[]): Promise<{ inserted: number; error: string | null }> {
  if (jobs.length === 0) return { inserted: 0, error: null };
  const rows = jobs.map((j) => ({
    kind: j.kind,
    user_id: j.user_id,
    thesis_id: j.thesis_id,
    pillar_id: j.pillar_id ?? null,
    ticker: j.ticker,
    source_key: j.source_key,
    payload: j.payload ?? {},
  }));
  const { data, error } = await db
    .from('judge_jobs')
    .upsert(rows, { onConflict: 'kind,user_id,source_key', ignoreDuplicates: true })
    .select('id');
  if (error) return { inserted: 0, error: error.message };
  return { inserted: data?.length ?? 0, error: null };
}

export async function countToday(db: Db, sinceIso: string): Promise<TodayCounts> {
  // The daily cap is in the hundreds, well under PostgREST's 1000-row page, so
  // one read of user ids is enough to count per user.
  const { data } = await db
    .from('judge_jobs')
    .select('user_id')
    .neq('kind', 'classify')
    .in('status', ['done', 'running'])
    .gte('started_at', sinceIso)
    .limit(1000);
  const byUser = new Map<string, number>();
  for (const r of data ?? []) {
    const uid = (r.user_id as string | null) ?? '';
    byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
  }
  return { total: data?.length ?? 0, byUser };
}

export interface ClaimResult {
  claimed: JudgeJobRow[];
  capped: number;
  /** Jobs already run today before this claim. */
  ranToday: number;
}

/**
 * Claim up to `cfg.batch` runnable jobs. Each claim is an atomic
 * queued -> running update on the row, so two workers that overlap can never
 * run the same job; they can run different jobs side by side, which is the
 * most concurrency the queue ever has.
 */
export async function claimJudgeJobs(db: Db, cfg: JudgeConfig, now: Date = new Date()): Promise<ClaimResult> {
  const nowIso = now.toISOString();
  const today = await countToday(db, etDayStartIso(now));
  const { data: queuedRaw } = await db
    .from('judge_jobs')
    .select('id, kind, user_id, thesis_id, pillar_id, ticker, source_key, payload, status, attempts, run_after, created_at')
    .eq('status', 'queued')
    .lte('run_after', nowIso)
    .order('created_at', { ascending: true })
    .limit(cfg.batch * 4);
  const queued = (queuedRaw ?? []) as JudgeJobRow[];
  const { claim, capped } = decideClaims(queued, today, cfg);

  for (const c of capped) {
    await db
      .from('judge_jobs')
      .update({ status: 'capped', error: c.reason, finished_at: nowIso })
      .eq('id', c.job.id)
      .eq('status', 'queued');
  }

  const claimed: JudgeJobRow[] = [];
  for (const job of claim) {
    const { data } = await db
      .from('judge_jobs')
      .update({ status: 'running', started_at: nowIso, attempts: job.attempts + 1, error: null })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('id');
    if (data && data.length === 1) claimed.push({ ...job, status: 'running', attempts: job.attempts + 1, started_at: nowIso });
  }
  return { claimed, capped: capped.length, ranToday: today.total };
}

export interface JudgeJobOutcome {
  status: 'done' | 'failed' | 'skipped' | 'deferred';
  /** Failure or skip reason; for deferred, why it waits. */
  error?: string | null;
  ledger?: UsageLedger;
  evidenceAdded?: number;
  statusChanges?: number;
  /** For deferred: how long to wait before the job is runnable again. */
  deferMs?: number;
}

/** The model that cost the most in this ledger, for the row's `model` column. */
export function dominantModel(ledger: UsageLedger | undefined): string | null {
  if (!ledger) return null;
  let best: string | null = null;
  let cost = -1;
  for (const [m, t] of Object.entries(ledger.byModel)) {
    if (t.costUsd > cost || (t.costUsd === cost && best === null)) { best = m; cost = t.costUsd; }
  }
  return best;
}

export async function finishJudgeJob(db: Db, job: JudgeJobRow, outcome: JudgeJobOutcome, now: Date = new Date()): Promise<void> {
  const nowIso = now.toISOString();
  if (outcome.status === 'deferred') {
    await db
      .from('judge_jobs')
      .update({
        status: 'queued',
        started_at: null,
        run_after: new Date(now.getTime() + (outcome.deferMs ?? 180_000)).toISOString(),
        error: outcome.error ?? null,
      })
      .eq('id', job.id);
    return;
  }
  const l = outcome.ledger;
  await db
    .from('judge_jobs')
    .update({
      status: outcome.status,
      finished_at: nowIso,
      error: outcome.error ?? null,
      model: dominantModel(l),
      calls: l?.calls ?? 0,
      input_tokens: l?.input ?? 0,
      output_tokens: l?.output ?? 0,
      cache_read_tokens: l?.cacheRead ?? 0,
      cost_usd: Number((l?.costUsd ?? 0).toFixed(6)),
      evidence_added: outcome.evidenceAdded ?? null,
      status_changes: outcome.statusChanges ?? null,
    })
    .eq('id', job.id);

  // A filing or news job scans the thesis's whole window, so every sibling
  // queued for the same thesis before that scan started was read by it. Close
  // them at zero cost instead of running the same scan again a minute later.
  // Investigate jobs carry their own injected source and cover nothing.
  if (outcome.status === 'done' && job.thesis_id && job.kind !== 'investigate') {
    await db
      .from('judge_jobs')
      .update({ status: 'done', finished_at: nowIso, error: `covered by ${job.id}` })
      .eq('thesis_id', job.thesis_id)
      .eq('status', 'queued')
      .in('kind', ['filing', 'news'])
      .lte('created_at', job.started_at ?? nowIso);
  }
}

export interface WorkerSummary {
  enabled: boolean;
  ranToday: number;
  claimed: number;
  done: number;
  failed: number;
  skipped: number;
  deferred: number;
  capped: number;
  costUsd: number;
  /** judge_jobs dollars already written today when this run started. */
  spentTodayUsd: number;
  ledger: UsageLedger;
  ms: number;
}

/**
 * One worker invocation: claim a batch, run it sequentially, write each
 * outcome back. Disabled means nothing is touched, not even a read. A job that
 * throws is marked failed with the message and the loop continues; a job can
 * never take the batch down with it.
 */
export async function runJudgeWorker(
  db: Db,
  cfg: JudgeConfig,
  runOne: (job: JudgeJobRow, log: string[]) => Promise<JudgeJobOutcome>,
  log: string[],
  now: () => Date = () => new Date(),
): Promise<WorkerSummary> {
  const started = now();
  const ledger = emptyLedger();
  const summary: WorkerSummary = {
    enabled: cfg.enabled, ranToday: 0, claimed: 0, done: 0, failed: 0, skipped: 0, deferred: 0, capped: 0,
    costUsd: 0, spentTodayUsd: 0, ledger, ms: 0,
  };
  if (!cfg.enabled) {
    log.push('[judge] disabled (JUDGE_ENABLED is not "true"); nothing claimed');
    return summary;
  }

  // The dollar cap comes before the claim so a capped day claims nothing and
  // the queue simply waits for midnight ET.
  summary.spentTodayUsd = await paidSpendSince(db, etDayStartIso(started));
  if (summary.spentTodayUsd >= cfg.dailyUsd) {
    log.push(`[judge] daily spend cap reached: $${summary.spentTodayUsd.toFixed(2)} of $${cfg.dailyUsd.toFixed(2)} today; nothing claimed`);
    summary.ms = now().getTime() - started.getTime();
    await beat(db, 'judge-worker', { claimed: 0, done: 0, failed: 0, capped: 0, costUsd: 0, spentTodayUsd: summary.spentTodayUsd, spendCapReached: true, ms: summary.ms });
    return summary;
  }

  const claim = await claimJudgeJobs(db, cfg, started);
  summary.ranToday = claim.ranToday;
  summary.claimed = claim.claimed.length;
  summary.capped = claim.capped;
  if (claim.capped > 0) log.push(`[judge] ${claim.capped} job(s) capped (ran today: ${claim.ranToday}, daily cap ${cfg.dailyCap}, user cap ${cfg.userCap})`);

  for (const job of claim.claimed) {
    const tag = `${job.kind} ${job.ticker ?? ''} ${job.source_key.slice(0, 60)}`;
    let outcome: JudgeJobOutcome;
    try {
      outcome = await runOne(job, log);
    } catch (err) {
      outcome = { status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
    if (outcome.ledger) mergeLedger(ledger, outcome.ledger);
    summary[outcome.status] += 1;
    log.push(`[judge] ${outcome.status} ${tag}${outcome.error ? ` (${outcome.error})` : ''}${outcome.ledger ? ` $${outcome.ledger.costUsd.toFixed(4)}` : ''}`);
    try {
      await finishJudgeJob(db, job, outcome, now());
    } catch (err) {
      log.push(`[judge] could not write outcome for ${job.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  summary.costUsd = Number(ledger.costUsd.toFixed(6));
  summary.ms = now().getTime() - started.getTime();
  await beat(db, 'judge-worker', { claimed: summary.claimed, done: summary.done, failed: summary.failed, capped: summary.capped, ranToday: summary.ranToday, costUsd: summary.costUsd, spentTodayUsd: summary.spentTodayUsd, ms: summary.ms });
  return summary;
}

/**
 * Dollars written to judge_jobs since `sinceIso`: rows finished since then, plus
 * rows created since then (classifier rows carry their cost at creation). Both
 * clauses, so a backlog judged today after days in the queue still counts today.
 */
export async function paidSpendSince(db: Db, sinceIso: string): Promise<number> {
  const { data } = await db
    .from('judge_jobs')
    .select('cost_usd')
    .or(`finished_at.gte.${sinceIso},created_at.gte.${sinceIso}`)
    .gt('cost_usd', 0)
    .limit(5000);
  const total = ((data ?? []) as { cost_usd: unknown }[]).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  return Number(total.toFixed(6));
}

/**
 * Record a classifier batch (or any model call outside a job) as a done
 * `classify` row, so the spend query over judge_jobs is the whole LLM spend of
 * the watch. Never counted against the caps.
 */
export async function recordLedgerRow(
  db: Db,
  args: { source_key: string; ledger: UsageLedger; payload?: Record<string, unknown>; ticker?: string | null },
): Promise<void> {
  const l = args.ledger;
  if (l.calls === 0) return;
  const nowIso = new Date().toISOString();
  await db.from('judge_jobs').insert({
    kind: 'classify',
    user_id: null,
    thesis_id: null,
    ticker: args.ticker ?? null,
    source_key: args.source_key,
    payload: args.payload ?? {},
    status: 'done',
    attempts: 1,
    started_at: nowIso,
    finished_at: nowIso,
    model: dominantModel(l),
    calls: l.calls,
    input_tokens: l.input,
    output_tokens: l.output,
    cache_read_tokens: l.cacheRead,
    cost_usd: Number(l.costUsd.toFixed(6)),
  });
}

export interface JudgeSpend {
  since: string;
  jobs: number;
  byStatus: Record<string, number>;
  byKind: Record<string, { jobs: number; costUsd: number }>;
  byModel: Record<string, { jobs: number; calls: number; input: number; output: number; costUsd: number }>;
  costUsd: number;
  capped: number;
  queued: number;
  oldestQueuedAt: string | null;
}

/** Spend and queue state since an instant, for check-cron and the lab. */
export async function judgeSpend(db: Db, sinceIso: string): Promise<JudgeSpend> {
  const { data } = await db
    .from('judge_jobs')
    .select('kind, status, model, calls, input_tokens, output_tokens, cost_usd, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(1000);
  const out: JudgeSpend = {
    since: sinceIso, jobs: 0, byStatus: {}, byKind: {}, byModel: {}, costUsd: 0, capped: 0, queued: 0, oldestQueuedAt: null,
  };
  for (const r of data ?? []) {
    out.jobs += 1;
    const status = String(r.status);
    out.byStatus[status] = (out.byStatus[status] ?? 0) + 1;
    const cost = Number(r.cost_usd) || 0;
    out.costUsd += cost;
    const kind = String(r.kind);
    const k = (out.byKind[kind] ??= { jobs: 0, costUsd: 0 });
    k.jobs += 1; k.costUsd += cost;
    if (r.model) {
      const m = (out.byModel[String(r.model)] ??= { jobs: 0, calls: 0, input: 0, output: 0, costUsd: 0 });
      m.jobs += 1; m.calls += Number(r.calls) || 0; m.input += Number(r.input_tokens) || 0;
      m.output += Number(r.output_tokens) || 0; m.costUsd += cost;
    }
    if (status === 'capped') out.capped += 1;
    if (status === 'queued') {
      out.queued += 1;
      if (!out.oldestQueuedAt) out.oldestQueuedAt = String(r.created_at);
    }
  }
  out.costUsd = Number(out.costUsd.toFixed(6));
  return out;
}
