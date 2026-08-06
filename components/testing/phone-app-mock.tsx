'use client';

// Lab · Helm on a phone.
//
// The TERMINAL at iPhone size, on the account picked in the lab sidebar. Five
// surfaces: the daily brief, the book, the findings inbox, the thesis layer,
// and taxes.
//
// Everything is live data. Nothing is seeded, and nothing is drawn that isn't
// backed by a real value — no decorative sparklines standing in for price
// history we don't have. Allocation bars and change bars are real numbers at
// real scale. A mock that shows invented data as real is a credibility bug.
//
// Copy discipline: Helm reports the distance between a rule the USER adopted
// and where their book sits. "NVDA is 31%, your cap is 20%" is arithmetic.
// "Trim NVDA" is advice, and advice needs a license we don't have.

import { useEffect, useMemo, useState } from 'react';
import { Newspaper, Layers, Inbox, Crosshair, Landmark } from 'lucide-react';

const SANS = { fontFamily: 'var(--font-sans)' } as const;
const MONO = { fontFamily: 'var(--font-mono)' } as const;

// Hero figures. A trading surface sets its numbers in the same grotesk it sets
// everything else in — tight, heavy, tabular. Instrument Serif is a display
// ACCENT in this design system, and putting it on the primary figure is the
// "make it look premium" reflex that reads instantly as generated. Two
// typefaces on screen: Inter for language, Space Grotesk for data.
const FIG = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  letterSpacing: '-0.035em',
  fontVariantNumeric: 'tabular-nums',
} as const;

const GOLD = '#E6B94D';
const POS = '#4ADE80';
const NEG = '#F87171';
const INK = '#FAFAFA';

type ProfileKey = 'aggressive' | 'moderate' | 'passive';

/* The user PICKS one; Helm never picks for them and never suggests which — that
   would be suitability analysis, which is advisory. Thresholds are placeholders
   until they trace to a published convention rather than to us. */
const PROFILES: Record<ProfileKey, { label: string; maxPosition: number; maxSector: number }> = {
  aggressive: { label: 'Aggressive', maxPosition: 30, maxSector: 50 },
  moderate:   { label: 'Moderate',   maxPosition: 20, maxSector: 35 },
  passive:    { label: 'Passive',    maxPosition: 12, maxSector: 25 },
};

/* Budgeting never reaches this product. Deny-list so a new portfolio-shaped
   insight type appears by default instead of vanishing silently. */
const EXCLUDED_INSIGHT_TYPES = new Set(['spending', 'credit', 'cash', 'subscription']);

type Tab = 'brief' | 'book' | 'inbox' | 'theses' | 'taxes';
const TABS: { key: Tab; label: string; Icon: typeof Inbox }[] = [
  { key: 'brief',  label: 'Brief',  Icon: Newspaper },
  { key: 'book',   label: 'Book',   Icon: Layers },
  { key: 'inbox',  label: 'Inbox',  Icon: Inbox },
  { key: 'theses', label: 'Theses', Icon: Crosshair },
  { key: 'taxes',  label: 'Taxes',  Icon: Landmark },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const compact = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : Math.abs(n) >= 10_000 ? `$${(n / 1000).toFixed(1)}k`
  : money(n);
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(n)}`;
const pct = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
const tone = (n: number) => (n >= 0 ? POS : NEG);

/** Red → neutral → green, saturating around ±3%. Real value, real ramp. */
function heatColor(changePct: number): string {
  const t = Math.max(-1, Math.min(1, changePct / 3));
  if (t >= 0) return `rgba(74, 222, 128, ${0.18 + t * 0.62})`;
  return `rgba(248, 113, 113, ${0.18 + -t * 0.62})`;
}

interface Finding {
  id: string;
  title: string;
  body: string;
  foot?: string;
  severity: 'high' | 'med' | 'low';
}

export function PhoneAppMock({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('brief');
  const [profile, setProfile] = useState<ProfileKey>('moderate');
  const [view, setView] = useState<'app' | 'lock'>('app');
  const [d, setD] = useState<Record<string, Any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      const grab = async (url: string) => {
        try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
      };
      const [holdings, insights, delta, thesis, taxes, brief] = await Promise.all([
        grab('/api/holdings'), grab('/api/insights'), grab('/api/dashboard/delta'),
        grab('/api/thesis'), grab('/api/dashboard/tax-opportunities'), grab('/api/dashboard/brief'),
      ]);
      if (!live) return;
      setD({
        holdings: Array.isArray(holdings) ? holdings : (holdings?.holdings ?? []),
        insights: insights?.insights ?? [],
        delta: delta && !delta.error ? delta : null,
        theses: thesis?.theses ?? [],
        taxes: taxes && !taxes.error ? taxes : null,
        brief: brief && !brief.error ? brief : null,
      });
      setLoading(false);
    })();
    return () => { live = false; };
  }, [email]);

  const rules = PROFILES[profile];

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = [];
    const holdings: Any[] = d.holdings ?? [];

    // Fold by ticker: the ICP holds one name across several brokerages, and an
    // unfolded list reports the same breach twice at half the size.
    const byTicker = new Map<string, number>();
    const bySector = new Map<string, number>();
    let book = 0;
    for (const h of holdings) {
      const v = Number(h.total_value ?? 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      book += v;
      const t = String(h.ticker ?? '').toUpperCase();
      if (t) byTicker.set(t, (byTicker.get(t) ?? 0) + v);
      const s = String(h.sector ?? '').trim();
      if (s) bySector.set(s, (bySector.get(s) ?? 0) + v);
    }

    if (book > 0) {
      for (const [ticker, value] of [...byTicker.entries()].sort((a, b) => b[1] - a[1])) {
        const p = (value / book) * 100;
        if (p <= rules.maxPosition) continue;
        out.push({
          id: `pos:${ticker}`,
          severity: p > rules.maxPosition * 1.5 ? 'high' : 'med',
          title: `${ticker} is ${p.toFixed(1)}% of your book`,
          body: `${rules.label} caps a single position at ${rules.maxPosition}%. That is ${(p - rules.maxPosition).toFixed(1)} points over, ${money(value - book * (rules.maxPosition / 100))} above the line.`,
          foot: `Your rule · ${rules.label}`,
        });
      }
      for (const [sector, value] of [...bySector.entries()].sort((a, b) => b[1] - a[1])) {
        const p = (value / book) * 100;
        if (p <= rules.maxSector) continue;
        out.push({
          id: `sec:${sector}`,
          severity: 'med',
          title: `${sector} is ${p.toFixed(0)}% of your book`,
          body: `${rules.label} caps one sector at ${rules.maxSector}%. ${(p - rules.maxSector).toFixed(0)} points over, ${money(value - book * (rules.maxSector / 100))} above the line.`,
          foot: `Your rule · ${rules.label}`,
        });
      }
    }

    const mover = d.delta?.mover;
    if (mover) {
      const head = d.delta?.headline;
      out.push({
        id: `mv:${mover.ticker}`,
        severity: Math.abs(mover.changePct) >= 5 ? 'high' : 'low',
        title: `${mover.ticker} ${pct(mover.changePct)}`,
        body: `${signed(mover.changePct >= 0 ? mover.dollarImpact : -mover.dollarImpact)} on your position.`,
        foot: head ? `${head.source}: “${head.title}”` : undefined,
      });
    }

    for (const i of (d.insights ?? []) as Any[]) {
      if (EXCLUDED_INSIGHT_TYPES.has(String(i.type ?? ''))) continue;
      const p = String(i.priority ?? '');
      out.push({
        id: `in:${i.id}`,
        severity: p === 'critical' || p === 'high' ? 'high' : p === 'medium' ? 'med' : 'low',
        title: String(i.title ?? ''),
        body: String(i.description ?? i.recommended_action ?? ''),
        foot: i.ticker ? `${i.ticker}${i.thesisStatus ? ` · thesis ${i.thesisStatus}` : ''}` : undefined,
      });
    }

    const rank = { high: 0, med: 1, low: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [d, rules]);

  const hidden = ((d.insights ?? []) as Any[]).filter(i => EXCLUDED_INSIGHT_TYPES.has(String(i.type ?? ''))).length;

  return (
    <div className="flex flex-wrap items-start gap-9">
      <style>{`
        @keyframes hmRise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
        @keyframes hmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hmGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .hm-rise { animation: hmRise .5s cubic-bezier(.16,1,.3,1) both; }
        .hm-fade { animation: hmFade .6s ease both; }
        .hm-grow { transform-origin: left; animation: hmGrow .7s cubic-bezier(.16,1,.3,1) both; }
        .hm-scroll::-webkit-scrollbar { display: none; }
        .hm-scroll { scrollbar-width: none; }
      `}</style>

      <Phone>
        {view === 'lock' ? (
          <LockScreen findings={findings} brief={d.brief} />
        ) : (
          <div className="flex h-full flex-col">
            <StatusBar />
            {loading ? (
              <p className="mt-28 text-center text-[12px] tracking-[0.16em] text-[#4A4A4A] uppercase hm-fade" style={MONO}>
                reading your book
              </p>
            ) : (
              <div key={tab} className="hm-scroll flex-1 overflow-y-auto">
                {tab === 'brief'  && <BriefScreen brief={d.brief} />}
                {tab === 'book'   && <BookScreen holdings={d.holdings} brief={d.brief} />}
                {tab === 'inbox'  && <InboxScreen findings={findings} profile={profile} setProfile={setProfile} />}
                {tab === 'theses' && <ThesesScreen theses={d.theses} brief={d.brief} />}
                {tab === 'taxes'  && <TaxesScreen taxes={d.taxes} />}
              </div>
            )}
            <TabBar tab={tab} setTab={setTab} badge={findings.length} />
          </div>
        )}
      </Phone>

      <aside className="w-[330px] min-w-[280px] space-y-5">
        <Panel title="View">
          <div className="flex gap-1.5">
            {(['app', 'lock'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 rounded px-3 py-2 text-[11.5px] transition-colors ${view === v ? 'text-[#0A0A0A] font-semibold' : 'bg-white/[0.04] text-[#B8B8B8] hover:text-[#FAFAFA]'}`}
                style={{ background: view === v ? GOLD : undefined, ...MONO }}>
                {v === 'app' ? 'App' : 'Lock screen'}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={`Rules · ${rules.label}`}>
          <Row k="Max single position" v={`${rules.maxPosition}%`} />
          <Row k="Max sector" v={`${rules.maxSector}%`} />
          <p className="mt-3 text-[11px] leading-[1.55] text-[#6A6A6A] m-0">
            The user picks the profile. Helm never suggests which — that would be suitability
            analysis. Thresholds are placeholders until sourced to a published convention.
          </p>
        </Panel>

        <Panel title="What is real here">
          <Row k="Account" v={email || '—'} />
          <Row k="Positions" v={String((d.holdings ?? []).length)} />
          <Row k="Theses" v={String((d.theses ?? []).length)} />
          <Row k="Findings" v={String(findings.length)} />
          <Row k="Harvestable" v={d.taxes ? money(d.taxes.totalHarvestableLoss ?? 0) : '—'} />
          <Row k="Budget items hidden" v={String(hidden)} />
          <p className="mt-3 text-[11px] leading-[1.55] text-[#6A6A6A] m-0">
            Live from holdings, insights, delta, thesis, tax-opportunities and brief. Bars are
            drawn from real values at real scale; nothing decorative stands in for data.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

/* ── Brief ────────────────────────────────────────────────────────────── */

function BriefScreen({ brief }: { brief: Any }) {
  if (!brief) return <Empty>No brief for this account yet.</Empty>;
  const p = brief.portfolio ?? {};
  const movers: Any[] = (brief.movers ?? []).slice(0, 5);
  const ti: Any[] = brief.thesisIntelligence ?? [];
  const chg = Number(p.overnightChangePct ?? 0);

  return (
    <div className="px-6 pt-7 pb-6">
      <Kicker>The Current</Kicker>
      <p className="mt-3.5 mb-0 text-[44px] leading-[0.95] hm-rise" style={{ color: INK, ...FIG }}>
        {money(p.totalValue ?? 0)}
      </p>
      <div className="mt-3 flex items-center gap-2 hm-rise" style={{ animationDelay: '60ms' }}>
        <span className="rounded-md px-2 py-[3px] text-[12px] font-semibold tabular-nums"
          style={{ color: tone(chg), background: chg >= 0 ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)', ...MONO }}>
          {pct(chg, 2)}
        </span>
        <span className="text-[12.5px] tabular-nums" style={{ color: tone(chg), ...MONO }}>
          {signed(p.overnightChange ?? 0)}
        </span>
        <span className="text-[11.5px] text-[#6A6A6A]" style={MONO}>{p.changeLabel ?? ''}</span>
      </div>

      {brief.digest && (
        <p className="mt-5 mb-0 text-[13.5px] leading-[1.65] text-[#B4B4B4] hm-fade" style={{ animationDelay: '120ms', ...SANS }}>
          {String(brief.digest).slice(0, 320)}{String(brief.digest).length > 320 ? '…' : ''}
        </p>
      )}

      {brief.thesisBrief?.headline && (
        <div className="mt-5 rounded-[12px] px-4 py-3.5 hm-rise" style={{
          animationDelay: '180ms',
          background: 'linear-gradient(rgba(230,185,77,0.075), rgba(230,185,77,0.025))',
          border: '1px solid rgba(230,185,77,0.16)',
        }}>
          <p className="m-0 text-[13px] leading-[1.55] text-[#EFE3C8]" style={SANS}>{brief.thesisBrief.headline}</p>
        </div>
      )}

      {brief.sectorHeat?.length > 0 && (
        <>
          <Rule label="Sector heat" />
          <div className="flex h-[26px] overflow-hidden rounded-[6px] hm-grow" style={{ animationDelay: '220ms' }}>
            {(brief.sectorHeat as Any[]).map((s: Any, i: number) => (
              <div key={i} title={`${s.sector} ${s.weight?.toFixed?.(0)}%`}
                style={{ width: `${s.weight}%`, background: heatColor(Number(s.changePct ?? 0)) }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {(brief.sectorHeat as Any[]).slice(0, 4).map((s: Any, i: number) => (
              <span key={i} className="text-[10px] text-[#6A6A6A]" style={MONO}>
                {s.sector} {Math.round(s.weight)}%
              </span>
            ))}
          </div>
        </>
      )}

      {movers.length > 0 && (
        <>
          <Rule label="Movers" />
          {movers.map((m: Any, i: number) => (
            <div key={m.ticker} className="flex items-center gap-3 py-[9px] hm-rise"
              style={{ animationDelay: `${260 + i * 40}ms`, borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
              <span className="w-[52px] text-[13px] font-semibold" style={{ color: INK, ...MONO }}>{m.ticker}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#6A6A6A]" style={SANS}>{m.sector}</span>
              <ChangeBar pctValue={Number(m.changePct ?? 0)} />
              <span className="w-[52px] text-right text-[12.5px] tabular-nums" style={{ color: tone(m.changePct), ...MONO }}>
                {pct(m.changePct)}
              </span>
            </div>
          ))}
        </>
      )}

      {ti.length > 0 && (
        <>
          <Rule label="Thesis intelligence" />
          {ti.slice(0, 3).map((t: Any, i: number) => (
            <Card key={i} delay={340 + i * 60}>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: INK, ...MONO }}>{t.ticker}</span>
                <StatusChip status={String(t.verdict ?? '')} />
              </div>
              {t.pillarClaim && <p className="mt-2 m-0 text-[12.5px] leading-[1.55] text-[#A4A4A4]" style={SANS}>{String(t.pillarClaim).slice(0, 145)}…</p>}
              {t.whatItMeans && <p className="mt-2 m-0 text-[11.5px] leading-[1.5] text-[#767676]" style={SANS}>{String(t.whatItMeans).slice(0, 130)}</p>}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Book ─────────────────────────────────────────────────────────────── */

function BookScreen({ holdings, brief }: { holdings: Any[]; brief: Any }) {
  const rows = useMemo(() => {
    const m = new Map<string, { ticker: string; value: number; pct: number | null; sector: string }>();
    for (const h of holdings ?? []) {
      const v = Number(h.total_value ?? 0);
      if (v <= 0) continue;
      const t = String(h.ticker ?? '').toUpperCase();
      const prev = m.get(t);
      if (prev) prev.value += v;
      else m.set(t, { ticker: t, value: v, pct: h.day_change_pct == null ? null : Number(h.day_change_pct), sector: String(h.sector ?? '') });
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [holdings]);

  const total = rows.reduce((s, r) => s + r.value, 0);
  const top = rows[0]?.value ?? 1;
  if (!rows.length) return <Empty>No positions on this account.</Empty>;
  const dayPct = Number(brief?.portfolio?.overnightChangePct ?? 0);

  return (
    <div className="px-6 pt-7 pb-6">
      <Kicker>Book · {rows.length} positions</Kicker>
      <p className="mt-3.5 mb-0 text-[40px] leading-[0.95] hm-rise" style={{ color: INK, ...FIG }}>
        {money(total)}
      </p>
      {brief?.portfolio && (
        <p className="mt-2.5 m-0 text-[12.5px] tabular-nums hm-rise" style={{ animationDelay: '60ms', color: tone(dayPct), ...MONO }}>
          {pct(dayPct, 2)} <span className="text-[#6A6A6A]">today</span>
        </p>
      )}

      <Rule label="Positions" />
      {rows.map((r, i) => (
        <div key={r.ticker} className="py-[10px] hm-rise"
          style={{ animationDelay: `${Math.min(i * 22, 400)}ms`, borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
          <div className="flex items-baseline gap-3">
            <span className="text-[13.5px] font-semibold" style={{ color: INK, ...MONO }}>{r.ticker}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#5F5F5F]" style={SANS}>{r.sector}</span>
            <span className="text-[13px] tabular-nums text-[#E4E4E4]" style={MONO}>{compact(r.value)}</span>
            <span className="w-[50px] text-right text-[11.5px] tabular-nums"
              style={{ color: r.pct == null ? '#4A4A4A' : tone(r.pct), ...MONO }}>
              {r.pct == null ? '—' : pct(r.pct)}
            </span>
          </div>
          {/* Allocation bar — real weight, scaled to the largest position. */}
          <div className="mt-[7px] flex items-center gap-2">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full hm-grow"
                style={{ width: `${(r.value / top) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, rgba(230,185,77,0.45))`, animationDelay: `${Math.min(i * 22, 400)}ms` }} />
            </div>
            <span className="w-[36px] text-right text-[10px] tabular-nums text-[#5F5F5F]" style={MONO}>
              {((r.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Inbox ────────────────────────────────────────────────────────────── */

function InboxScreen({ findings, profile, setProfile }: {
  findings: Finding[]; profile: ProfileKey; setProfile: (p: ProfileKey) => void;
}) {
  const SEV = { high: NEG, med: GOLD, low: '#5A5A5A' } as const;
  const LABEL = { high: 'Attention', med: 'Watch', low: 'Note' } as const;

  return (
    <div className="px-6 pt-7 pb-6">
      <Kicker>Inbox</Kicker>
      <p className="mt-3 mb-0 max-w-[280px] text-[21px] font-semibold leading-[1.28] tracking-[-0.02em] hm-rise" style={{ color: INK, ...SANS }}>
        {findings.length === 0 ? 'Nothing crossed your lines.' : `${findings.length} thing${findings.length === 1 ? '' : 's'} while you were gone.`}
      </p>

      {/* The profile pick, living where the brokerage ask used to be. Three taps,
          no account needed, and it gives "connect" a reason to exist. */}
      <div className="mt-5 mb-1 flex gap-1.5 hm-fade" style={{ animationDelay: '80ms' }}>
        {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
          <button key={k} onClick={() => setProfile(k)}
            className={`flex-1 rounded-full py-[7.5px] text-[11px] transition-all ${profile === k ? 'text-[#0A0A0A] font-semibold' : 'text-[#9A9A9A] hover:text-[#DADADA]'}`}
            style={{ background: profile === k ? GOLD : 'rgba(255,255,255,0.055)', ...MONO }}>
            {PROFILES[k].label}
          </button>
        ))}
      </div>

      <Rule label="Findings" />
      {findings.length === 0 && (
        <p className="mt-8 text-center text-[13px] leading-[1.65] text-[#5F5F5F]" style={SANS}>
          Your book is inside every rule you picked.<br />That is the answer, not an empty state.
        </p>
      )}
      {findings.map((f, i) => (
        <Card key={f.id} delay={120 + i * 55} accent={SEV[f.severity]}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full" style={{ background: SEV[f.severity] }} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: SEV[f.severity], ...MONO }}>
              {LABEL[f.severity]}
            </span>
          </div>
          <p className="m-0 text-[14.5px] font-semibold leading-[1.35]" style={{ color: INK, ...SANS }}>{f.title}</p>
          <p className="mt-2 m-0 text-[12.5px] leading-[1.6] text-[#A4A4A4]" style={SANS}>{f.body}</p>
          {f.foot && <p className="mt-2.5 m-0 text-[10.5px] leading-[1.45] text-[#5F5F5F]" style={MONO}>{f.foot}</p>}
        </Card>
      ))}
    </div>
  );
}

/* ── Theses ───────────────────────────────────────────────────────────── */

function ThesesScreen({ theses, brief }: { theses: Any[]; brief: Any }) {
  const list = theses ?? [];
  if (!list.length) return <Empty>No theses on this account yet.</Empty>;

  const rank: Record<string, number> = { broken: 0, weakening: 1, unverified: 2, intact: 3 };
  const worst = (t: Any) => Math.min(...((t.pillars ?? []).map((p: Any) => rank[String(p.status)] ?? 3).concat(3)));
  const sorted = [...list].sort((a, b) => worst(a) - worst(b));
  const s = brief?.pillarSummary ?? {};

  return (
    <div className="px-6 pt-7 pb-6">
      <Kicker>Theses · {list.length} tracked</Kicker>
      <div className="mt-4 flex gap-2">
        {([['intact', POS], ['weakening', GOLD], ['broken', NEG]] as const).map(([k, c], i) => (
          <div key={k} className="flex-1 rounded-[11px] px-3 py-2.5 hm-rise"
            style={{ animationDelay: `${i * 60}ms`, background: 'linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="m-0 text-[22px] leading-none" style={{ color: c, ...FIG }}>{s[k] ?? 0}</p>
            <p className="m-0 mt-1.5 text-[9px] uppercase tracking-[0.13em] text-[#6A6A6A]" style={MONO}>{k}</p>
          </div>
        ))}
      </div>

      <Rule label="Worst first" />
      {sorted.map((t: Any, i: number) => {
        const pillars: Any[] = t.pillars ?? [];
        const flagged = pillars.find((p: Any) => p.status === 'broken' || p.status === 'weakening') ?? pillars[0];
        return (
          <Card key={t.id} delay={140 + i * 45}>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-bold" style={{ color: INK, ...MONO }}>{t.ticker}</span>
              {flagged && <StatusChip status={String(flagged.status)} />}
              <span className="ml-auto text-[10px] text-[#5A5A5A]" style={MONO}>{pillars.length} pillars</span>
            </div>
            {flagged?.claim && (
              <p className="mt-2 m-0 text-[12px] leading-[1.6] text-[#A4A4A4]" style={SANS}>{String(flagged.claim).slice(0, 155)}…</p>
            )}
            <div className="mt-3 flex gap-[3px]">
              {pillars.map((p: Any) => (
                <div key={p.id} className="h-[3px] flex-1 rounded-full"
                  style={{ background: p.status === 'broken' ? NEG : p.status === 'weakening' ? GOLD : p.status === 'intact' ? POS : '#333' }} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Taxes ────────────────────────────────────────────────────────────── */

function TaxesScreen({ taxes }: { taxes: Any }) {
  if (!taxes) return <Empty>Tax center needs Pro on this account.</Empty>;
  const ops: Any[] = taxes.opportunities ?? [];
  const cap = taxes.annualCap ?? {};

  return (
    <div className="px-6 pt-7 pb-6">
      <Kicker>Estimated tax saved</Kicker>
      <p className="mt-3.5 mb-0 text-[44px] leading-[0.95] hm-rise" style={{ color: POS, ...FIG }}>
        {money(taxes.totalEstimatedSavings ?? 0)}
      </p>
      <p className="mt-2.5 m-0 text-[12px] text-[#7A7A7A] hm-rise" style={{ animationDelay: '60ms', ...MONO }}>
        from {money(taxes.totalHarvestableLoss ?? 0)} in harvestable losses
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Mini k="Deduction cap" v={money(cap.annualDeductionCap ?? 0)} delay={110} />
        <Mini k="Carryforward" v={money(cap.estimatedCarryforward ?? 0)} delay={150} />
      </div>

      <Rule label="Positions" />
      {ops.length === 0 && <p className="m-0 text-[12.5px] text-[#5F5F5F]" style={SANS}>Nothing harvestable right now.</p>}
      {ops.map((o: Any, i: number) => (
        <Card key={o.ticker} delay={190 + i * 55} accent={POS}>
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-bold" style={{ color: INK, ...MONO }}>{o.ticker}</span>
            <span className="ml-auto text-[16px]" style={{ color: POS, ...FIG }}>{money(o.estimatedSavings ?? 0)}</span>
          </div>
          <p className="mt-2 m-0 text-[12px] leading-[1.55] text-[#A4A4A4]" style={SANS}>
            {money(o.unrealizedLoss ?? 0)} unrealized loss ·{' '}
            {o.holdingPeriod === 'long_term' ? 'long-term' : o.holdingPeriod === 'short_term' ? 'short-term' : 'unclassified'}
          </p>
          {typeof o.daysToLongTerm === 'number' && o.daysToLongTerm > 0 && (
            <div className="mt-2.5">
              <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full hm-grow"
                  style={{ width: `${Math.max(2, 100 - (o.daysToLongTerm / 365) * 100)}%`, background: GOLD, animationDelay: `${190 + i * 55}ms` }} />
              </div>
              <p className="mt-1.5 m-0 text-[10.5px] text-[#6A6A6A]" style={MONO}>{o.daysToLongTerm} days to long-term</p>
            </div>
          )}
        </Card>
      ))}

      {taxes.disclaimer && (
        <p className="mt-6 m-0 text-[10.5px] leading-[1.55] text-[#565656]" style={SANS}>{String(taxes.disclaimer).slice(0, 210)}</p>
      )}
    </div>
  );
}

/* ── Lock screen ──────────────────────────────────────────────────────── */

function LockScreen({ findings, brief }: { findings: Finding[]; brief: Any }) {
  const top = findings[0];
  const n = findings.length;
  const chg = brief?.portfolio?.overnightChangePct;

  return (
    <div className="flex h-full flex-col" style={{ background: 'radial-gradient(120% 60% at 50% 0%, #16181F 0%, #0A0B0E 45%, #060606 100%)' }}>
      <StatusBar />
      <div className="pt-16 pb-10 text-center hm-fade">
        <p className="m-0 text-[15px] text-[#9A9A9A]" style={SANS}>Wednesday, August 5</p>
        <p className="m-0 text-[84px] font-light leading-[0.95] tracking-[-0.04em]" style={{ color: INK, ...SANS }}>9:41</p>
      </div>
      <div className="space-y-2.5 px-3">
        {n === 0 ? (
          <Notif body="Nothing crossed your lines today." delay={0} />
        ) : (
          <>
            <Notif delay={0} body={top.title.includes(' is ') ? `${top.title.split(' is ')[0]} crossed your cap. ${top.title}.` : top.title} />
            {n > 1 && <Notif dim delay={90} body={`${n - 1} more finding${n - 1 === 1 ? '' : 's'} on your book.`} />}
          </>
        )}
        {typeof chg === 'number' && <Notif dim delay={180} body={`Your book is ${pct(chg, 2)} overnight.`} />}
      </div>
      <p className="mt-auto mb-9 text-center text-[10.5px] tracking-[0.1em] text-[#3F3F3F]" style={MONO}>
        push copy · no advice verb, no ticker recommendation
      </p>
    </div>
  );
}

function Notif({ body, dim, delay }: { body: string; dim?: boolean; delay: number }) {
  return (
    <div className="rounded-[20px] px-4 py-3.5 hm-rise"
      style={{ animationDelay: `${delay}ms`, background: dim ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.11)', backdropFilter: 'blur(24px)' }}>
      <div className="mb-1.5 flex items-center gap-2">
        <div className="grid h-[19px] w-[19px] place-items-center rounded-[5.5px] text-[9.5px] font-bold text-[#0A0A0A]"
          style={{ background: `linear-gradient(135deg, #FFD67A, ${GOLD})` }}>H</div>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.11em] text-[#D2D2D2]" style={MONO}>Helm</span>
        <span className="ml-auto text-[11px] text-[#8A8A8A]" style={SANS}>now</span>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.45]" style={{ color: INK, ...SANS }}>{body}</p>
    </div>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────────── */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative shrink-0" style={{ width: 393, height: 852 }}>
      {/* ambient */}
      <div className="pointer-events-none absolute -inset-16 -z-10"
        style={{ background: 'radial-gradient(50% 40% at 50% 30%, rgba(230,185,77,0.10), transparent 70%)' }} />
      {/* side buttons */}
      <div className="absolute -left-[13px] top-[132px] h-[30px] w-[3px] rounded-l" style={{ background: '#232326' }} />
      <div className="absolute -left-[13px] top-[186px] h-[54px] w-[3px] rounded-l" style={{ background: '#232326' }} />
      <div className="absolute -left-[13px] top-[254px] h-[54px] w-[3px] rounded-l" style={{ background: '#232326' }} />
      <div className="absolute -right-[13px] top-[210px] h-[84px] w-[3px] rounded-r" style={{ background: '#232326' }} />

      <div className="h-full w-full" style={{
        borderRadius: 56, padding: 11,
        background: 'linear-gradient(150deg, #34343A, #17171A 30%, #101012 70%, #2A2A30)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: 45, background: '#060606' }}>
          <div className="absolute left-1/2 top-[10px] z-20 -translate-x-1/2"
            style={{ width: 120, height: 34, borderRadius: 20, background: '#000' }} />
          {/* screen sheen */}
          <div className="pointer-events-none absolute inset-0 z-30"
            style={{ background: 'linear-gradient(158deg, rgba(255,255,255,0.045) 0%, transparent 26%)' }} />
          <div className="flex h-full w-full flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-8 pt-3.5 pb-1">
      <span className="text-[14px] font-semibold" style={{ color: INK, ...SANS }}>9:41</span>
      <span className="flex items-center gap-[5px]">
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: INK }} />)}
        </span>
        <span style={{ width: 22, height: 11, borderRadius: 3, border: `1px solid rgba(250,250,250,0.5)`, padding: 1.5, display: 'inline-block' }}>
          <span style={{ display: 'block', width: '75%', height: '100%', borderRadius: 1.5, background: INK }} />
        </span>
      </span>
    </div>
  );
}

function TabBar({ tab, setTab, badge }: { tab: Tab; setTab: (t: Tab) => void; badge: number }) {
  return (
    <nav className="flex shrink-0 pb-7 pt-2"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(rgba(255,255,255,0.018), transparent)' }}>
      {TABS.map(({ key, label, Icon }) => {
        const on = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)} className="relative flex-1 flex flex-col items-center gap-[5px] pt-1.5 transition-colors">
            {on && <span className="absolute top-0 h-[2px] w-[22px] rounded-full" style={{ background: GOLD }} />}
            <span className="relative">
              <Icon size={17} strokeWidth={on ? 2.1 : 1.7} color={on ? GOLD : '#5A5A5A'} />
              {key === 'inbox' && badge > 0 && (
                <span className="absolute -right-[7px] -top-[5px] min-w-[15px] rounded-full px-[3.5px] text-center text-[9px] font-bold leading-[15px] text-[#0A0A0A]"
                  style={{ background: GOLD, ...MONO }}>{badge}</span>
              )}
            </span>
            <span className="text-[9.5px] tracking-[0.02em]" style={{ color: on ? GOLD : '#5A5A5A', ...MONO }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Primitives ───────────────────────────────────────────────────────── */

function Card({ children, delay = 0, accent }: { children: React.ReactNode; delay?: number; accent?: string }) {
  return (
    <div className="mb-2.5 rounded-[13px] px-4 py-3.5 hm-rise" style={{
      animationDelay: `${delay}ms`,
      background: 'linear-gradient(rgba(255,255,255,0.052), rgba(255,255,255,0.022))',
      border: '1px solid rgba(255,255,255,0.065)',
      ...(accent ? { borderLeft: `2px solid ${accent}` } : {}),
    }}>
      {children}
    </div>
  );
}

function ChangeBar({ pctValue }: { pctValue: number }) {
  const w = Math.min(Math.abs(pctValue) / 5, 1) * 34;
  return (
    <span className="relative inline-block h-[3px] w-[70px] shrink-0 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <span className="absolute top-0 h-full rounded-full"
        style={{ background: tone(pctValue), width: `${w}px`, left: pctValue >= 0 ? '50%' : `${35 - w}px` }} />
      <span className="absolute left-1/2 top-[-2px] h-[7px] w-px" style={{ background: 'rgba(255,255,255,0.14)' }} />
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const c = status === 'broken' || status === 'contradicted' ? NEG
    : status === 'weakening' || status === 'watch' ? GOLD
    : status === 'intact' || status === 'confirmed' ? POS : '#6A6A6A';
  return (
    <span className="rounded-[4px] px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.11em]"
      style={{ color: c, background: `${c}1A`, ...MONO }}>{status}</span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-[10px] font-medium uppercase tracking-[0.13em] hm-fade" style={{ color: 'rgba(230,185,77,0.85)', ...MONO }}>
      {children}
    </p>
  );
}

function Rule({ label }: { label: string }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-2.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]" style={MONO}>{label}</span>
      <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.09), transparent)' }} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 pt-20 text-center text-[13px] leading-[1.65] text-[#5F5F5F]" style={SANS}>{children}</p>;
}

function Mini({ k, v, delay = 0 }: { k: string; v: string; delay?: number }) {
  return (
    <div className="rounded-[11px] px-3.5 py-3 hm-rise" style={{
      animationDelay: `${delay}ms`,
      background: 'linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
      border: '1px solid rgba(255,255,255,0.055)',
    }}>
      <p className="m-0 text-[15px] tabular-nums" style={{ color: '#E4E4E4', ...MONO }}>{v}</p>
      <p className="m-0 mt-1 text-[9px] uppercase tracking-[0.12em] text-[#6A6A6A]" style={MONO}>{k}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.07] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="m-0 mb-2.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>{title}</p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-[11.5px] text-[#8A8A8A]">{k}</span>
      <span className="truncate text-[11.5px] text-[#FAFAFA]" style={MONO}>{v}</span>
    </div>
  );
}
