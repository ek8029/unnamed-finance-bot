// Lab shell · The Watch. What the pollers and the judge queue did and what it
// cost, from judge_jobs, filing_events and watch_heartbeats (migration 072).
// A cap nobody can see is a cap nobody trusts. Service client, dev only, no
// LLM on this page, no emails (jobs show a user id prefix).

import { notFound } from 'next/navigation';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { judgeSpend, etDayStartIso, readJudgeConfig } from '@/lib/agent/judge-queue';
import { readHeartbeats } from '@/lib/agent/heartbeat';

export const metadata = { title: 'Watch · Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
const RULE = 'border-[var(--color-rule)]';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8A8A]" style={MONO}>{children}</div>;
}

function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'under a minute ago';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) === 1 ? '' : 's'} ago`;
}

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '');
const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function Kpi({ label, value, receipt }: { label: string; value: string; receipt: string }) {
  return (
    <div className="py-3.5 pr-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[#FAFAFA]">{value}</div>
      <div className="mt-1.5 text-[10.5px] leading-[1.5] text-[#6A6A6A]" style={MONO}>{receipt}</div>
    </div>
  );
}

export default async function LabWatchPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const db = createStaticServiceClient();
  const cfg = readJudgeConfig();
  const todayIso = etDayStartIso();
  const weekIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // A HEAD probe on a missing table comes back with no body and no error; a real select says so.
  const probe = await db.from('judge_jobs').select('id').limit(1);
  const migrationApplied = !probe.error;

  const [today, week, beats, jobsRes, eventsRes] = await Promise.all([
    judgeSpend(db, todayIso),
    judgeSpend(db, weekIso),
    readHeartbeats(db),
    db.from('judge_jobs')
      .select('id, kind, ticker, source_key, status, model, calls, input_tokens, output_tokens, cost_usd, evidence_added, error, user_id, created_at, finished_at')
      .order('created_at', { ascending: false }).limit(25),
    db.from('filing_events')
      .select('accession_no, ticker, form, title, filed_at, seen_at, status, note')
      .order('seen_at', { ascending: false }).limit(25),
  ]);
  const jobs = (jobsRes.data ?? []) as Record<string, unknown>[];
  const events = (eventsRes.data ?? []) as Record<string, unknown>[];

  const beatRow = (name: 'edgar-watch' | 'news-watch' | 'judge-worker', cadence: string) => {
    const b = beats.get(name);
    const d = (b?.detail ?? {}) as Record<string, unknown>;
    const brief = Object.entries(d).filter(([k]) => k !== 'ms').slice(0, 6).map(([k, v]) => `${k} ${typeof v === 'number' && k.toLowerCase().includes('cost') ? usd(v) : String(v)}`).join(' · ');
    return (
      <li key={name} className={`grid grid-cols-[150px_150px_minmax(0,1fr)] items-baseline gap-x-4 border-b ${RULE} py-2 last:border-0`}>
        <span className="text-[12.5px] text-[#D4D4D4]" style={MONO}>{name}</span>
        <span className={`text-[12px] tabular-nums ${b ? 'text-[#4ADE80]' : 'text-[#6A6A6A]'}`} style={MONO} title={b ? clock(b.at) : ''}>{ago(b?.at ?? null)}</span>
        <span className="text-[10.5px] text-[#6A6A6A] truncate" style={MONO}>{cadence}{brief ? ` · ${brief}` : ''}</span>
      </li>
    );
  };

  return (
    <div className="max-w-[1080px]">
      <div className="mb-6">
        <h1 className="m-0 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#FAFAFA]">The Watch</h1>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-[#8A8A8A] m-0" style={MONO}>
          judge {cfg.enabled ? <span className="text-[#4ADE80]">ON</span> : <span className="text-[#F87171]">OFF</span>} · daily cap {cfg.dailyCap} · user cap {cfg.userCap} · batch {cfg.batch}
          {!migrationApplied && <span className="text-[#F87171]"> · migration 072 not applied: no tables yet</span>}
        </p>
      </div>

      <section>
        <Eyebrow>Pollers · last looked</Eyebrow>
        <ul className="m-0 mt-2 list-none p-0">
          {beatRow('edgar-watch', 'every 1 min in session, 5 min off hours')}
          {beatRow('news-watch', 'every 5 min, 40 names a tick')}
          {beatRow('judge-worker', `every 1 min, up to ${cfg.batch} jobs`)}
        </ul>
      </section>

      <div className={`mt-8 grid grid-cols-2 md:grid-cols-5 border-y ${RULE} divide-x divide-[var(--color-rule)]`}>
        <div><Kpi label="Spend today" value={usd(today.costUsd)} receipt={`${today.jobs} rows since midnight ET`} /></div>
        <div className="pl-4"><Kpi label="Spend 7 days" value={usd(week.costUsd)} receipt={`${week.jobs} rows`} /></div>
        <div className="pl-4"><Kpi label="Judged today" value={String((today.byStatus.done ?? 0) + (today.byStatus.running ?? 0) - (today.byKind.classify?.jobs ?? 0))} receipt={`of ${cfg.dailyCap} · ${today.byStatus.failed ?? 0} failed · ${today.byStatus.skipped ?? 0} skipped`} /></div>
        <div className="pl-4"><Kpi label="Capped today" value={String(today.capped)} receipt={today.capped > 0 ? 'held for the hourly read' : 'nobody hit a cap'} /></div>
        <div className="pl-4"><Kpi label="In the queue" value={String(week.queued)} receipt={week.oldestQueuedAt ? `oldest ${ago(week.oldestQueuedAt)}` : 'empty'} /></div>
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
        <section>
          <Eyebrow>By model · 7 days</Eyebrow>
          <table className="mt-2 w-full border-collapse text-[12px]" style={MONO}>
            <tbody>
              {Object.entries(week.byModel).sort((a, b) => b[1].costUsd - a[1].costUsd).map(([m, t]) => (
                <tr key={m} className={`border-b ${RULE}`}>
                  <td className="py-2 text-[#D4D4D4]">{m}</td>
                  <td className="py-2 text-right tabular-nums text-[#8A8A8A]">{t.calls} calls</td>
                  <td className="py-2 text-right tabular-nums text-[#8A8A8A]">{t.input.toLocaleString('en-US')} in · {t.output.toLocaleString('en-US')} out</td>
                  <td className="py-2 text-right tabular-nums text-[#FAFAFA]">{usd(t.costUsd)}</td>
                </tr>
              ))}
              {Object.keys(week.byModel).length === 0 && <tr><td className="py-2 text-[#6A6A6A]">no model calls recorded yet</td></tr>}
            </tbody>
          </table>
        </section>
        <section>
          <Eyebrow>By kind · 7 days</Eyebrow>
          <table className="mt-2 w-full border-collapse text-[12px]" style={MONO}>
            <tbody>
              {Object.entries(week.byKind).sort((a, b) => b[1].costUsd - a[1].costUsd).map(([k, t]) => (
                <tr key={k} className={`border-b ${RULE}`}>
                  <td className="py-2 text-[#D4D4D4]">{k}</td>
                  <td className="py-2 text-right tabular-nums text-[#8A8A8A]">{t.jobs} rows</td>
                  <td className="py-2 text-right tabular-nums text-[#FAFAFA]">{usd(t.costUsd)}</td>
                </tr>
              ))}
              {Object.entries(week.byStatus).map(([s, n]) => (
                <tr key={`s-${s}`} className={`border-b ${RULE}`}>
                  <td className="py-2 text-[#6A6A6A]">status {s}</td>
                  <td className="py-2 text-right tabular-nums text-[#8A8A8A]">{n}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-8">
        <Eyebrow>Last 25 jobs</Eyebrow>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-[11.5px]" style={MONO}>
            <thead>
              <tr className="text-left text-[#6A6A6A]">
                <th className="py-1.5 font-normal">created</th><th className="font-normal">kind</th><th className="font-normal">ticker</th><th className="font-normal">status</th><th className="font-normal">model</th>
                <th className="text-right font-normal">tokens</th><th className="text-right font-normal">cost</th><th className="text-right font-normal">found</th><th className="font-normal">user</th><th className="font-normal">note</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={String(j.id)} className={`border-t ${RULE}`}>
                  <td className="py-1.5 whitespace-nowrap text-[#8A8A8A]">{clock(String(j.created_at))}</td>
                  <td className="text-[#D4D4D4]">{String(j.kind)}</td>
                  <td className="text-[#D4D4D4]">{String(j.ticker ?? '')}</td>
                  <td className={j.status === 'done' ? 'text-[#4ADE80]' : j.status === 'failed' ? 'text-[#F87171]' : j.status === 'capped' ? 'text-[var(--color-gold)]' : 'text-[#8A8A8A]'}>{String(j.status)}</td>
                  <td className="text-[#8A8A8A]">{String(j.model ?? '')}</td>
                  <td className="text-right tabular-nums text-[#8A8A8A]">{Number(j.input_tokens) + Number(j.output_tokens) > 0 ? `${Number(j.input_tokens).toLocaleString('en-US')}/${Number(j.output_tokens).toLocaleString('en-US')}` : ''}</td>
                  <td className="text-right tabular-nums text-[#FAFAFA]">{Number(j.cost_usd) > 0 ? usd(Number(j.cost_usd)) : ''}</td>
                  <td className="text-right tabular-nums text-[#8A8A8A]">{j.evidence_added == null ? '' : String(j.evidence_added)}</td>
                  <td className="text-[#6A6A6A]">{j.user_id ? String(j.user_id).slice(0, 8) : ''}</td>
                  <td className="max-w-[260px] truncate text-[#6A6A6A]" title={String(j.error ?? j.source_key)}>{String(j.error ?? '')}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td className="py-2 text-[#6A6A6A]" colSpan={10}>no jobs yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow>Last 25 filings seen on watched names</Eyebrow>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-[11.5px]" style={MONO}>
            <thead>
              <tr className="text-left text-[#6A6A6A]">
                <th className="py-1.5 font-normal">seen</th><th className="font-normal">ticker</th><th className="font-normal">form</th><th className="font-normal">filer</th><th className="font-normal">accepted</th><th className="font-normal">lag</th><th className="font-normal">status</th><th className="font-normal">note</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const lagMin = Math.round((new Date(String(e.seen_at)).getTime() - new Date(String(e.filed_at)).getTime()) / 60000);
                return (
                  <tr key={String(e.accession_no)} className={`border-t ${RULE}`}>
                    <td className="py-1.5 whitespace-nowrap text-[#8A8A8A]">{clock(String(e.seen_at))}</td>
                    <td className="text-[#D4D4D4]">{String(e.ticker)}</td>
                    <td className="text-[#D4D4D4]">{String(e.form)}</td>
                    <td className="max-w-[220px] truncate text-[#8A8A8A]">{String(e.title ?? '')}</td>
                    <td className="whitespace-nowrap text-[#8A8A8A]">{clock(String(e.filed_at))}</td>
                    <td className="tabular-nums text-[#8A8A8A]">{lagMin >= 0 ? `${lagMin} min` : ''}</td>
                    <td className={e.status === 'queued' || e.status === 'judged' ? 'text-[#4ADE80]' : 'text-[#8A8A8A]'}>{String(e.status)}</td>
                    <td className="max-w-[260px] truncate text-[#6A6A6A]">{String(e.note ?? '')}</td>
                  </tr>
                );
              })}
              {events.length === 0 && <tr><td className="py-2 text-[#6A6A6A]" colSpan={8}>nothing seen yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
