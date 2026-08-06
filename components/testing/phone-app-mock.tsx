'use client';

// Lab · the app, as a phone.
//
// Purpose: answer three questions before anyone pays Apple $99 or writes a line
// of React Native.
//   1. Does a badge of N findings actually pull you in?
//   2. Is the copy imperative enough to be useful and careful enough to be legal?
//   3. Does a real book generate enough findings to justify a daily open?
//
// Everything on this screen is REAL data for the account picked in the lab
// sidebar. Nothing is seeded. If the inbox looks thin, that is the finding.
//
// Copy discipline, enforced throughout: Helm never recommends a transaction. It
// reports the distance between a rule the USER adopted and where their book
// actually sits. "NVDA is 31%, your cap is 20%" is arithmetic. "Trim NVDA" is
// advice, and advice needs a license we do not have.

import { useEffect, useMemo, useState } from 'react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

/* ── Profiles ─────────────────────────────────────────────────────────────
   The user PICKS one of these; Helm never picks for them and never suggests
   which to pick (that would be suitability analysis, which is advisory).
   Thresholds below are placeholders — before this ships they need to trace to
   a published convention rather than to us. */

type ProfileKey = 'aggressive' | 'moderate' | 'passive';

const PROFILES: Record<ProfileKey, { label: string; blurb: string; maxPosition: number; maxSector: number }> = {
  aggressive: { label: 'Aggressive', blurb: 'Concentration is the point.', maxPosition: 30, maxSector: 50 },
  moderate:   { label: 'Moderate',   blurb: 'Conviction, with guardrails.', maxPosition: 20, maxSector: 35 },
  passive:    { label: 'Passive',    blurb: 'Spread wide, check rarely.',   maxPosition: 12, maxSector: 25 },
};

/* Budgeting never reaches this surface. Helm is not a spending tracker, and an
   inbox with "you spent more at DoorDash" in it is the exact thing that makes
   the product read as one. Deny-list, not allow-list, so a new portfolio-shaped
   insight type shows up by default instead of vanishing silently. */
const EXCLUDED_INSIGHT_TYPES = new Set(['spending', 'credit', 'cash', 'subscription']);

interface Finding {
  id: string;
  kind: 'breach' | 'move' | 'insight';
  title: string;
  body: string;
  foot?: string;
  severity: 'high' | 'med' | 'low';
  amount?: number;
}

interface HoldingRow { ticker: string; total_value: number; sector?: string | null }

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

export function PhoneAppMock({ email }: { email: string }) {
  const [profile, setProfile] = useState<ProfileKey>('moderate');
  const [view, setView] = useState<'inbox' | 'lock'>('inbox');
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [insights, setInsights] = useState<Record<string, unknown>[]>([]);
  const [delta, setDelta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      const grab = async (url: string) => {
        try {
          const r = await fetch(url);
          return r.ok ? await r.json() : null;
        } catch { return null; }
      };
      const [h, i, d] = await Promise.all([
        grab('/api/holdings'),
        grab('/api/insights'),
        grab('/api/dashboard/delta'),
      ]);
      if (!live) return;
      const list = Array.isArray(h) ? h : (h?.holdings ?? []);
      setHoldings(list as HoldingRow[]);
      setInsights((i?.insights ?? []) as Record<string, unknown>[]);
      setDelta(d && !d.error ? d : null);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [email]);

  const rules = PROFILES[profile];

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = [];

    // Fold by ticker first — the ICP holds one name across several brokerages,
    // and an unfolded list reports the same breach twice at half the size.
    const byTicker = new Map<string, number>();
    const bySector = new Map<string, number>();
    let book = 0;
    for (const h of holdings) {
      const v = Number(h.total_value ?? 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      book += v;
      const t = String(h.ticker ?? '').toUpperCase();
      if (t) byTicker.set(t, (byTicker.get(t) ?? 0) + v);
      const s = (h.sector ?? '').trim();
      if (s) bySector.set(s, (bySector.get(s) ?? 0) + v);
    }

    if (book > 0) {
      for (const [ticker, value] of [...byTicker.entries()].sort((a, b) => b[1] - a[1])) {
        const pct = (value / book) * 100;
        if (pct <= rules.maxPosition) continue;
        const over = value - book * (rules.maxPosition / 100);
        out.push({
          id: `pos:${ticker}`,
          kind: 'breach',
          severity: pct > rules.maxPosition * 1.5 ? 'high' : 'med',
          title: `${ticker} is ${pct.toFixed(1)}% of your book`,
          body: `${rules.label} caps a single position at ${rules.maxPosition}%. That is ${(pct - rules.maxPosition).toFixed(1)} points over, ${money(over)} above the line.`,
          foot: `Your rule · ${rules.label}`,
          amount: over,
        });
      }

      for (const [sector, value] of [...bySector.entries()].sort((a, b) => b[1] - a[1])) {
        const pct = (value / book) * 100;
        if (pct <= rules.maxSector) continue;
        const over = value - book * (rules.maxSector / 100);
        out.push({
          id: `sec:${sector}`,
          kind: 'breach',
          severity: 'med',
          title: `${sector} is ${pct.toFixed(0)}% of your book`,
          body: `${rules.label} caps one sector at ${rules.maxSector}%. ${(pct - rules.maxSector).toFixed(0)} points over, ${money(over)} above the line.`,
          foot: `Your rule · ${rules.label}`,
          amount: over,
        });
      }
    }

    // What moved. Reuses the delta route already shipped on /dashboard.
    const mover = delta?.mover as { ticker: string; changePct: number; dollarImpact: number } | null | undefined;
    if (mover) {
      const head = delta?.headline as { title: string; source: string } | null | undefined;
      const up = mover.changePct >= 0;
      out.push({
        id: `mv:${mover.ticker}`,
        kind: 'move',
        severity: Math.abs(mover.changePct) >= 5 ? 'high' : 'low',
        title: `${mover.ticker} ${up ? '+' : ''}${mover.changePct.toFixed(1)}%`,
        body: `${up ? '+' : '−'}${money(mover.dollarImpact)} on your position.`,
        foot: head ? `${head.source}: “${head.title}”` : undefined,
      });
    }

    // Real agent findings, minus anything budget-shaped.
    for (const i of insights) {
      const type = String(i.type ?? '');
      if (EXCLUDED_INSIGHT_TYPES.has(type)) continue;
      const p = String(i.priority ?? '');
      out.push({
        id: `in:${String(i.id)}`,
        kind: 'insight',
        severity: p === 'critical' || p === 'high' ? 'high' : p === 'medium' ? 'med' : 'low',
        title: String(i.title ?? ''),
        body: String(i.description ?? i.recommended_action ?? ''),
        foot: i.ticker ? `${String(i.ticker)}${i.thesisStatus ? ` · thesis ${String(i.thesisStatus)}` : ''}` : undefined,
        amount: typeof i.estimated_impact === 'number' ? i.estimated_impact : undefined,
      });
    }

    const rank = { high: 0, med: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [holdings, insights, delta, rules]);

  const excludedCount = insights.filter(i => EXCLUDED_INSIGHT_TYPES.has(String(i.type ?? ''))).length;

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone>
        {view === 'lock'
          ? <LockScreen findings={findings} />
          : <InboxScreen findings={findings} profile={profile} setProfile={setProfile} loading={loading} />}
      </Phone>

      <aside className="w-[330px] min-w-[280px] space-y-5">
        <Panel title="View">
          <div className="flex gap-1.5">
            {(['inbox', 'lock'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 rounded px-3 py-2 text-[11.5px] transition-colors ${
                  view === v ? 'bg-[#E6B94D] text-[#0A0A0A] font-semibold' : 'bg-white/[0.04] text-[#B8B8B8] hover:text-[#FAFAFA]'
                }`}
                style={MONO}
              >
                {v === 'inbox' ? 'Inbox' : 'Lock screen'}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={`Rules · ${rules.label}`}>
          <Row k="Max single position" v={`${rules.maxPosition}%`} />
          <Row k="Max sector" v={`${rules.maxSector}%`} />
          <p className="mt-3 text-[11px] leading-[1.55] text-[#6A6A6A] m-0">
            The user picks the profile. Helm never suggests which one — that would be
            suitability analysis. Thresholds are placeholders until they trace to a
            published convention.
          </p>
        </Panel>

        <Panel title="What is real here">
          <Row k="Account" v={email || '—'} />
          <Row k="Positions" v={String(holdings.length)} />
          <Row k="Findings shown" v={String(findings.length)} />
          <Row k="Budget items hidden" v={String(excludedCount)} />
          <p className="mt-3 text-[11px] leading-[1.55] text-[#6A6A6A] m-0">
            Live from /api/holdings, /api/insights and /api/dashboard/delta through the lab
            cookie. Nothing seeded. A thin inbox is a real result, not a broken mock.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────────── */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 393, height: 852, borderRadius: 54,
        background: '#0A0A0A',
        border: '10px solid #1C1C1E',
        boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* dynamic island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{ top: 11, width: 118, height: 34, borderRadius: 20, background: '#000' }}
      />
      <div className="h-full w-full overflow-hidden flex flex-col" style={{ borderRadius: 44, background: '#060606' }}>
        {children}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-7 pt-3.5 pb-1 text-[13px] font-semibold text-[#FAFAFA] shrink-0">
      <span style={MONO}>9:41</span>
      <span className="tracking-[0.1em] text-[10px] text-[#8A8A8A]" style={MONO}>▪▪▪ ▮</span>
    </div>
  );
}

/* ── Lock screen — the question is whether this earns the open ─────────── */

function LockScreen({ findings }: { findings: Finding[] }) {
  const top = findings[0];
  const n = findings.length;

  return (
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(#0B0D12, #060606 60%)' }}>
      <StatusBar />
      <div className="pt-14 pb-8 text-center">
        <p className="m-0 text-[15px] text-[#B8B8B8]" style={MONO}>Tuesday, August 5</p>
        <p className="m-0 text-[76px] font-semibold leading-none tracking-[-0.03em] text-[#FAFAFA]">9:41</p>
      </div>

      <div className="px-3 space-y-2.5">
        {n === 0 ? (
          <Notif title="Helm" body="Nothing crossed your lines today." />
        ) : (
          <>
            <Notif
              title="Helm"
              body={
                top?.kind === 'breach'
                  ? `${top.title.split(' is ')[0]} crossed your cap. ${top.title}.`
                  : top?.title ?? ''
              }
            />
            {n > 1 && (
              <Notif title="Helm" body={`${n - 1} more finding${n - 1 === 1 ? '' : 's'} on your book.`} dim />
            )}
          </>
        )}
      </div>

      <p className="mt-auto mb-8 text-center text-[11px] text-[#4A4A4A]" style={MONO}>
        push copy · no advice verb, no ticker recommendation
      </p>
    </div>
  );
}

function Notif({ title, body, dim }: { title: string; body: string; dim?: boolean }) {
  return (
    <div
      className="rounded-[18px] px-4 py-3 backdrop-blur"
      style={{ background: dim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[9px] font-bold text-[#0A0A0A]"
          style={{ background: '#E6B94D' }}
        >
          H
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#D8D8D8]" style={MONO}>{title}</span>
        <span className="ml-auto text-[11px] text-[#8A8A8A]" style={MONO}>now</span>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.45] text-[#FAFAFA]">{body}</p>
    </div>
  );
}

/* ── Inbox ────────────────────────────────────────────────────────────── */

function InboxScreen({
  findings, profile, setProfile, loading,
}: {
  findings: Finding[];
  profile: ProfileKey;
  setProfile: (p: ProfileKey) => void;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />

      <header className="px-5 pt-7 pb-3 shrink-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[19px] font-bold tracking-[0.02em] text-[#FAFAFA]">HELM</span>
          {findings.length > 0 && (
            <span
              className="rounded-full px-2 py-[2px] text-[10.5px] font-bold text-[#0A0A0A]"
              style={{ background: '#E6B94D', ...MONO }}
            >
              {findings.length}
            </span>
          )}
        </div>
        <p className="mt-1.5 m-0 text-[13px] leading-[1.5] text-[#8A8A8A]">
          {loading ? 'Checking your book…'
            : findings.length === 0 ? 'Nothing crossed your lines.'
            : `${findings.length} thing${findings.length === 1 ? '' : 's'} while you were gone.`}
        </p>
      </header>

      {/* The profile pick, living where the brokerage ask used to be. Three taps,
          no account required, and it gives "connect" a reason to exist. */}
      <div className="flex gap-1.5 px-5 pb-3 shrink-0">
        {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
          <button
            key={k}
            onClick={() => setProfile(k)}
            className={`flex-1 rounded-full py-[7px] text-[11px] transition-colors ${
              profile === k ? 'text-[#0A0A0A] font-semibold' : 'text-[#9A9A9A]'
            }`}
            style={{ background: profile === k ? '#E6B94D' : 'rgba(255,255,255,0.05)', ...MONO }}
          >
            {PROFILES[k].label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2.5">
        {!loading && findings.length === 0 && (
          <p className="mt-10 text-center text-[13px] leading-[1.6] text-[#5F5F5F]">
            Your book is inside every rule you picked.
            <br />
            That is the answer, not an empty state.
          </p>
        )}
        {findings.map(f => <Card key={f.id} f={f} />)}
      </div>

      <nav className="flex shrink-0 border-t border-white/[0.07] pb-7 pt-2.5">
        {[['Inbox', true], ['Book', false], ['You', false]].map(([label, active]) => (
          <div key={String(label)} className="flex-1 text-center">
            <p
              className={`m-0 text-[10.5px] ${active ? 'text-[#E6B94D]' : 'text-[#5F5F5F]'}`}
              style={MONO}
            >
              {String(label)}
            </p>
          </div>
        ))}
      </nav>
    </div>
  );
}

const SEV: Record<Finding['severity'], string> = {
  high: '#F87171',
  med:  '#E6B94D',
  low:  '#4A4A4A',
};

function Card({ f }: { f: Finding }) {
  return (
    <div
      className="rounded-[13px] px-4 py-3.5"
      style={{
        background: 'rgba(255,255,255,0.028)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `2.5px solid ${SEV[f.severity]}`,
      }}
    >
      <p className="m-0 text-[14.5px] font-semibold leading-[1.35] text-[#FAFAFA]">{f.title}</p>
      <p className="mt-1.5 m-0 text-[12.5px] leading-[1.55] text-[#A8A8A8]">{f.body}</p>
      {f.foot && (
        <p className="mt-2 m-0 text-[10.5px] leading-[1.45] text-[#5F5F5F]" style={MONO}>{f.foot}</p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.07] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="m-0 mb-2.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-[11.5px] text-[#8A8A8A]">{k}</span>
      <span className="text-[11.5px] text-[#FAFAFA] truncate" style={MONO}>{v}</span>
    </div>
  );
}
