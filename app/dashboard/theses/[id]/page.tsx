// /dashboard/theses/[id] - thesis detail. Home for the agentic reassessment artifact.
// Server-rendered, RLS-scoped to the signed-in user. Header conviction, the
// reassessment block, then the pillars with their cited evidence (broken first).

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { investigationForThesis } from '@/lib/thesis-investigation';
import { summarizePillars } from '@/lib/thesis-summary';
import { STATUS_META, dotGlow, convictionColor, type PillarStatus } from '@/lib/thesis-palette';
import { CompanyLogo } from '@/components/company-logo';
import { Reassessment } from '@/components/thesis/reassessment';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

interface PillarRow {
  id: string;
  claim: string;
  status: PillarStatus;
  status_override: PillarStatus | null;
}

interface EvidenceRow {
  pillar_id: string;
  excerpt: string;
  source_title: string;
  source_url: string | null;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: string;
  what_it_means: string | null;
  source_published_at: string | null;
}

const SEVERITY: Record<PillarStatus, number> = { broken: 0, weakening: 1, unverified: 2, intact: 3 };

function StatusChip({ status }: { status: PillarStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07] shrink-0" style={MONO}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: dotGlow(status) }} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

function LockedPanel() {
  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
      <div className="max-w-[460px] rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] p-6 space-y-3">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          Pro
        </div>
        <p className="text-[15px] leading-[1.5] text-[#9A9A9A] m-0">Thesis detail is a Pro feature.</p>
        <Link
          href="/pricing"
          className="inline-block font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors"
          style={MONO}
        >
          See plans
        </Link>
      </div>
    </div>
  );
}

export default async function ThesisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!(await hasThesisAccess(user.id, user.email))) {
    return <LockedPanel />;
  }

  const { data: thesis } = await supabase
    .from('theses')
    .select('id, ticker, tracked')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!thesis) notFound();

  const { data: pillarsRaw } = await supabase
    .from('thesis_pillars')
    .select('id, claim, status, status_override')
    .eq('thesis_id', id)
    .eq('confirmed', true);
  const pillars = (pillarsRaw ?? []) as PillarRow[];

  const pillarIds = pillars.map((p) => p.id);
  let evidenceByPillar = new Map<string, EvidenceRow[]>();
  if (pillarIds.length > 0) {
    const { data: evidenceRaw } = await supabase
      .from('pillar_evidence')
      .select('pillar_id, excerpt, source_title, source_url, verdict, materiality, source_type, what_it_means, source_published_at')
      .in('pillar_id', pillarIds);
    evidenceByPillar = new Map();
    for (const e of (evidenceRaw ?? []) as EvidenceRow[]) {
      const arr = evidenceByPillar.get(e.pillar_id) ?? [];
      arr.push(e);
      evidenceByPillar.set(e.pillar_id, arr);
    }
  }

  const investigation = await investigationForThesis(supabase, id, thesis.ticker);

  // Conviction summary (mirror the theses page: intact fraction drives color + %).
  const summary = summarizePillars(
    pillars.map((p) => ({ confirmed: true, status: p.status, status_override: p.status_override, lifecycle: 'active' })),
  );
  const total = summary.confirmedCount;
  const intact = summary.statusCounts.intact;
  const intactFrac = total > 0 ? intact / total : 0;

  // Effective status + broken/weakening first.
  const ordered = [...pillars]
    .map((p) => ({ ...p, eff: (p.status_override ?? p.status) as PillarStatus }))
    .sort((a, b) => SEVERITY[a.eff] - SEVERITY[b.eff]);

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Back link */}
      <Link
        href="/dashboard/theses"
        className="inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
        style={MONO}
      >
        &larr; Theses
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <CompanyLogo ticker={thesis.ticker} size={44} className="shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-[26px] font-bold uppercase tracking-[0.04em] text-[#FAFAFA] leading-none" style={MONO}>
            {thesis.ticker}
          </div>
        </div>
        {total > 0 && (
          <div className="ml-auto flex items-baseline gap-2 shrink-0">
            <span className="font-mono text-[28px] leading-none font-semibold tabular-nums" style={{ ...MONO, color: convictionColor(intactFrac) }}>
              {Math.round(intactFrac * 100)}%
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>
              conviction intact
            </span>
          </div>
        )}
      </div>

      {/* Reassessment */}
      <Reassessment investigation={investigation} />

      {/* Pillars */}
      <section className="space-y-3">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]" style={MONO}>
          The reasons you own this
        </div>
        {ordered.length === 0 ? (
          <p className="font-mono text-[13px] text-[#6A6A6A]" style={MONO}>No confirmed pillars yet.</p>
        ) : (
          <div className="space-y-3">
            {ordered.map((p) => {
              const evidence = evidenceByPillar.get(p.id) ?? [];
              return (
                <div key={p.id} className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <StatusChip status={p.eff} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-semibold text-[#FAFAFA] leading-snug">{p.claim}</div>
                      {evidence.length > 0 && (
                        <div className="mt-3 space-y-2.5 border-l border-white/[0.07] pl-4">
                          {evidence.map((e, i) => (
                            <div key={i}>
                              {e.source_url ? (
                                <a
                                  href={e.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#9A9A9A] hover:text-[#E6B94D] transition-colors"
                                  style={MONO}
                                >
                                  {e.source_title}
                                </a>
                              ) : (
                                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#6A6A6A]" style={MONO}>
                                  {e.source_title}
                                </span>
                              )}
                              <p className="text-[12.5px] leading-[1.55] text-[#7A7A7A] mt-1 mb-0 italic">&ldquo;{e.excerpt}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
