'use client';

// Lab · Helm on a phone.
//
// The TERMINAL at iPhone size, not a notification list. Five surfaces, all live
// on the account picked in the lab sidebar: the daily brief, the book, the
// findings inbox, the thesis layer, and taxes.
//
// The first pass of this mockup showed only an inbox, which quietly reduced an
// intelligence terminal to a push feed and buried the two surfaces the closest
// competitor has nothing of — theses and taxes. Scope decisions about what a v1
// ships belong after seeing the real thing, not baked into the picture of it.
//
// Everything here is real data through the lab cookie. Nothing seeded.
//
// Copy discipline throughout: Helm reports the distance between a rule the USER
// adopted and where their book sits. "NVDA is 31%, your cap is 20%" is
// arithmetic. "Trim NVDA" is advice, and advice needs a license we don't have.

import { useEffect, useMemo, useState } from 'react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const GOLD = '#E6B94D';
const POS = '#4ADE80';
const NEG = '#F87171';

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
const TABS: { key: Tab; label: string }[] = [
  { key: 'brief',  label: 'Brief' },
  { key: 'book',   label: 'Book' },
  { key: 'inbox',  label: 'Inbox' },
  { key: 'theses', label: 'Theses' },
  { key: 'taxes',  label: 'Taxes' },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(n)}`;
const pct = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
const toneOf = (n: number) => (n >= 0 ? POS : NEG);

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
        grab('/api/holdings'),
        grab('/api/insights'),
        grab('/api/dashboard/delta'),
        grab('/api/thesis'),
        grab('/api/dashboard/tax-opportunities'),
        grab('/api/dashboard/brief'),
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
    <div className="flex flex-wrap items-start gap-8">
      <Phone>
        {view === 'lock' ? (
          <LockScreen findings={findings} brief={d.brief} />
        ) : (
          <div className="flex h-full flex-col">
            <StatusBar />
            {loading ? (
              <p className="mt-24 text-center text-[13px] text-[#5F5F5F]" style={MONO}>reading your book…</p>
            ) : (
              <div className="flex-1 overflow-y-auto">
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
            Live from holdings, insights, delta, thesis, tax-opportunities and brief through the
            lab cookie. Nothing seeded.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

/* ── Screens ──────────────────────────────────────────────────────────── */

function BriefScreen({ brief }: { brief: Any }) {
  if (!brief) return <Empty>No brief for this account yet.</Empty>;
  const p = brief.portfolio ?? {};
  const movers: Any[] = (brief.movers ?? []).slice(0, 4);
  const ti: Any[] = brief.thesisIntelligence ?? [];

  return (
    <div className="px-5 pt-6 pb-4">
      <Eyebrow>The Current</Eyebrow>
      <p className="mt-1 mb-0 text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#FAFAFA]" style={MONO}>
        {money(p.totalValue ?? 0)}
      </p>
      <p className="mt-1.5 m-0 text-[13px]" style={{ color: toneOf(p.overnightChangePct ?? 0), ...MONO }}>
        {signed(p.overnightChange ?? 0)} · {pct(p.overnightChangePct ?? 0, 2)}
        <span className="text-[#6A6A6A]"> {p.changeLabel ?? ''}</span>
      </p>

      {brief.digest && (
        <p className="mt-4 mb-0 text-[13px] leading-[1.6] text-[#C8C8C8]">
          {String(brief.digest).slice(0, 340)}
          {String(brief.digest).length > 340 ? '…' : ''}
        </p>
      )}

      {brief.thesisBrief?.headline && (
        <div className="mt-4 rounded-[11px] px-3.5 py-3" style={{ background: 'rgba(230,185,77,0.05)', border: '1px solid rgba(230,185,77,0.18)' }}>
          <p className="m-0 text-[12.5px] leading-[1.5] text-[#E8E8E8]">{brief.thesisBrief.headline}</p>
        </div>
      )}

      {movers.length > 0 && (
        <>
          <Eyebrow className="mt-6">Movers</Eyebrow>
          <div className="mt-2 space-y-px">
            {movers.map((m: Any) => (
              <div key={m.ticker} className="flex items-baseline justify-between py-[7px] border-b border-white/[0.05]">
                <span className="text-[13px] font-semibold text-[#FAFAFA]" style={MONO}>{m.ticker}</span>
                <span className="ml-auto mr-3 text-[11.5px] text-[#6A6A6A] truncate max-w-[130px]">{m.sector}</span>
                <span className="text-[12.5px] tabular-nums" style={{ color: toneOf(m.changePct), ...MONO }}>{pct(m.changePct)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {ti.length > 0 && (
        <>
          <Eyebrow className="mt-6">Thesis intelligence</Eyebrow>
          {ti.slice(0, 3).map((t: Any, n: number) => (
            <div key={n} className="mt-2 rounded-[11px] px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold text-[#FAFAFA]" style={MONO}>{t.ticker}</span>
                <StatusDot status={String(t.verdict ?? '')} />
              </div>
              {t.pillarClaim && <p className="mt-1.5 m-0 text-[12px] leading-[1.5] text-[#A8A8A8]">{String(t.pillarClaim).slice(0, 150)}</p>}
              {t.whatItMeans && <p className="mt-1.5 m-0 text-[11.5px] leading-[1.5] text-[#7A7A7A]">{String(t.whatItMeans).slice(0, 140)}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BookScreen({ holdings, brief }: { holdings: Any[]; brief: Any }) {
  const rows = useMemo(() => {
    const m = new Map<string, { ticker: string; value: number; pct: number | null; sector: string }>();
    for (const h of holdings ?? []) {
      const v = Number(h.total_value ?? 0);
      if (v <= 0) continue;
      const t = String(h.ticker ?? '').toUpperCase();
      const prev = m.get(t);
      const dp = h.day_change_pct == null ? null : Number(h.day_change_pct);
      if (prev) prev.value += v;
      else m.set(t, { ticker: t, value: v, pct: dp, sector: String(h.sector ?? '') });
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [holdings]);

  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length) return <Empty>No positions on this account.</Empty>;

  return (
    <div className="px-5 pt-6 pb-4">
      <Eyebrow>Book · {rows.length} positions</Eyebrow>
      <p className="mt-1 mb-4 text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#FAFAFA]" style={MONO}>
        {money(total)}
      </p>
      {brief?.sectorHeat?.length > 0 && (
        <div className="mb-4 flex h-[5px] overflow-hidden rounded-full">
          {(brief.sectorHeat as Any[]).slice(0, 7).map((s: Any, i: number) => (
            <div key={i} style={{ width: `${s.weight}%`, background: i % 2 ? 'rgba(230,185,77,0.55)' : 'rgba(230,185,77,0.28)' }} />
          ))}
        </div>
      )}
      <div className="space-y-px">
        {rows.map(r => (
          <div key={r.ticker} className="flex items-center gap-3 py-[9px] border-b border-white/[0.05]">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13.5px] font-semibold text-[#FAFAFA]" style={MONO}>{r.ticker}</p>
              {r.sector && <p className="m-0 text-[10.5px] text-[#5F5F5F] truncate">{r.sector}</p>}
            </div>
            <div className="text-right">
              <p className="m-0 text-[13px] tabular-nums text-[#E8E8E8]" style={MONO}>{money(r.value)}</p>
              <p className="m-0 text-[11px] tabular-nums" style={{ color: r.pct == null ? '#5F5F5F' : toneOf(r.pct), ...MONO }}>
                {r.pct == null ? '—' : pct(r.pct)}
              </p>
            </div>
            <span className="w-[42px] text-right text-[10.5px] text-[#5F5F5F]" style={MONO}>
              {((r.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxScreen({ findings, profile, setProfile }: {
  findings: Finding[]; profile: ProfileKey; setProfile: (p: ProfileKey) => void;
}) {
  const SEV = { high: NEG, med: GOLD, low: '#4A4A4A' } as const;
  return (
    <div className="px-5 pt-6 pb-4">
      <Eyebrow>Inbox</Eyebrow>
      <p className="mt-1 mb-3 text-[15px] leading-[1.45] text-[#E8E8E8]">
        {findings.length === 0 ? 'Nothing crossed your lines.' : `${findings.length} thing${findings.length === 1 ? '' : 's'} while you were gone.`}
      </p>

      {/* The profile pick, living where the brokerage ask used to be. Three taps,
          no account needed, and it gives "connect" a reason to exist. */}
      <div className="mb-4 flex gap-1.5">
        {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
          <button key={k} onClick={() => setProfile(k)}
            className={`flex-1 rounded-full py-[7px] text-[11px] transition-colors ${profile === k ? 'text-[#0A0A0A] font-semibold' : 'text-[#9A9A9A]'}`}
            style={{ background: profile === k ? GOLD : 'rgba(255,255,255,0.05)', ...MONO }}>
            {PROFILES[k].label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {findings.length === 0 && (
          <p className="mt-8 text-center text-[13px] leading-[1.6] text-[#5F5F5F]">
            Your book is inside every rule you picked.<br />That is the answer, not an empty state.
          </p>
        )}
        {findings.map(f => (
          <div key={f.id} className="rounded-[13px] px-4 py-3.5"
            style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2.5px solid ${SEV[f.severity]}` }}>
            <p className="m-0 text-[14px] font-semibold leading-[1.35] text-[#FAFAFA]">{f.title}</p>
            <p className="mt-1.5 m-0 text-[12.5px] leading-[1.55] text-[#A8A8A8]">{f.body}</p>
            {f.foot && <p className="mt-2 m-0 text-[10.5px] leading-[1.45] text-[#5F5F5F]" style={MONO}>{f.foot}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThesesScreen({ theses, brief }: { theses: Any[]; brief: Any }) {
  const list = theses ?? [];
  if (!list.length) return <Empty>No theses on this account yet.</Empty>;

  const rank: Record<string, number> = { broken: 0, weakening: 1, unverified: 2, intact: 3 };
  const worst = (t: Any) => Math.min(...((t.pillars ?? []).map((p: Any) => rank[String(p.status)] ?? 3).concat(3)));
  const sorted = [...list].sort((a, b) => worst(a) - worst(b));
  const s = brief?.pillarSummary ?? {};

  return (
    <div className="px-5 pt-6 pb-4">
      <Eyebrow>Theses · {list.length} tracked</Eyebrow>
      <div className="mt-2 mb-4 flex gap-2">
        {([['intact', POS], ['weakening', GOLD], ['broken', NEG]] as const).map(([k, c]) => (
          <div key={k} className="flex-1 rounded-[10px] px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.028)' }}>
            <p className="m-0 text-[17px] font-semibold leading-none" style={{ color: c, ...MONO }}>{s[k] ?? 0}</p>
            <p className="m-0 mt-1 text-[9.5px] uppercase tracking-[0.1em] text-[#6A6A6A]" style={MONO}>{k}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {sorted.map((t: Any) => {
          const pillars: Any[] = t.pillars ?? [];
          const flagged = pillars.find((p: Any) => p.status === 'broken' || p.status === 'weakening') ?? pillars[0];
          return (
            <div key={t.id} className="rounded-[13px] px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-bold text-[#FAFAFA]" style={MONO}>{t.ticker}</span>
                {flagged && <StatusDot status={String(flagged.status)} />}
                <span className="ml-auto text-[10px] text-[#5F5F5F]" style={MONO}>{pillars.length} pillars</span>
              </div>
              {flagged?.claim && (
                <p className="mt-2 m-0 text-[12px] leading-[1.55] text-[#A8A8A8]">{String(flagged.claim).slice(0, 165)}…</p>
              )}
              <div className="mt-2.5 flex gap-1">
                {pillars.map((p: Any) => (
                  <div key={p.id} className="h-[3px] flex-1 rounded-full"
                    style={{ background: p.status === 'broken' ? NEG : p.status === 'weakening' ? GOLD : p.status === 'intact' ? POS : '#3A3A3A' }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaxesScreen({ taxes }: { taxes: Any }) {
  if (!taxes) return <Empty>Tax center needs Pro on this account.</Empty>;
  const ops: Any[] = taxes.opportunities ?? [];
  const cap = taxes.annualCap ?? {};

  return (
    <div className="px-5 pt-6 pb-4">
      <Eyebrow>Harvestable</Eyebrow>
      <p className="mt-1 mb-0 text-[26px] font-semibold leading-none tracking-[-0.02em]" style={{ color: POS, ...MONO }}>
        {money(taxes.totalEstimatedSavings ?? 0)}
      </p>
      <p className="mt-1.5 m-0 text-[12px] text-[#8A8A8A]" style={MONO}>
        estimated tax saved · {money(taxes.totalHarvestableLoss ?? 0)} in losses
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Mini k="Deduction cap" v={money(cap.annualDeductionCap ?? 0)} />
        <Mini k="Carryforward" v={money(cap.estimatedCarryforward ?? 0)} />
      </div>

      <Eyebrow className="mt-6">Positions</Eyebrow>
      <div className="mt-2 space-y-2.5">
        {ops.length === 0 && <p className="m-0 text-[12.5px] text-[#5F5F5F]">Nothing harvestable right now.</p>}
        {ops.map((o: Any) => (
          <div key={o.ticker} className="rounded-[13px] px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13.5px] font-bold text-[#FAFAFA]" style={MONO}>{o.ticker}</span>
              <span className="ml-auto text-[13px] tabular-nums" style={{ color: POS, ...MONO }}>{money(o.estimatedSavings ?? 0)}</span>
            </div>
            <p className="mt-1.5 m-0 text-[12px] leading-[1.5] text-[#A8A8A8]">
              {money(o.unrealizedLoss ?? 0)} unrealized loss · {o.holdingPeriod === 'long_term' ? 'long-term' : o.holdingPeriod === 'short_term' ? 'short-term' : 'unclassified'}
            </p>
            {typeof o.daysToLongTerm === 'number' && o.daysToLongTerm > 0 && (
              <p className="mt-1 m-0 text-[11px] text-[#6A6A6A]" style={MONO}>
                {o.daysToLongTerm} days to long-term
              </p>
            )}
          </div>
        ))}
      </div>

      {taxes.disclaimer && (
        <p className="mt-5 m-0 text-[10.5px] leading-[1.5] text-[#5F5F5F]">{String(taxes.disclaimer).slice(0, 220)}</p>
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
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(#0B0D12, #060606 60%)' }}>
      <StatusBar />
      <div className="pt-14 pb-8 text-center">
        <p className="m-0 text-[15px] text-[#B8B8B8]" style={MONO}>Wednesday, August 5</p>
        <p className="m-0 text-[76px] font-semibold leading-none tracking-[-0.03em] text-[#FAFAFA]">9:41</p>
      </div>
      <div className="px-3 space-y-2.5">
        {n === 0 ? (
          <Notif body="Nothing crossed your lines today." />
        ) : (
          <>
            <Notif body={top.title.includes(' is ') ? `${top.title.split(' is ')[0]} crossed your cap. ${top.title}.` : top.title} />
            {n > 1 && <Notif dim body={`${n - 1} more finding${n - 1 === 1 ? '' : 's'} on your book.`} />}
          </>
        )}
        {typeof chg === 'number' && (
          <Notif dim body={`Your book is ${pct(chg, 2)} overnight.`} />
        )}
      </div>
      <p className="mt-auto mb-8 text-center text-[11px] text-[#4A4A4A]" style={MONO}>
        push copy · no advice verb, no ticker recommendation
      </p>
    </div>
  );
}

function Notif({ body, dim }: { body: string; dim?: boolean }) {
  return (
    <div className="rounded-[18px] px-4 py-3 backdrop-blur" style={{ background: dim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[9px] font-bold text-[#0A0A0A]" style={{ background: GOLD }}>H</div>
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#D8D8D8]" style={MONO}>Helm</span>
        <span className="ml-auto text-[11px] text-[#8A8A8A]" style={MONO}>now</span>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.45] text-[#FAFAFA]">{body}</p>
    </div>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────────── */

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative shrink-0" style={{
      width: 393, height: 852, borderRadius: 54, background: '#0A0A0A',
      border: '10px solid #1C1C1E',
      boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
    }}>
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: 11, width: 118, height: 34, borderRadius: 20, background: '#000' }} />
      <div className="h-full w-full overflow-hidden flex flex-col" style={{ borderRadius: 44, background: '#060606' }}>{children}</div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-7 pt-3.5 pb-1 text-[13px] font-semibold text-[#FAFAFA]">
      <span style={MONO}>9:41</span>
      <span className="text-[10px] tracking-[0.1em] text-[#8A8A8A]" style={MONO}>▪▪▪ ▮</span>
    </div>
  );
}

function TabBar({ tab, setTab, badge }: { tab: Tab; setTab: (t: Tab) => void; badge: number }) {
  return (
    <nav className="flex shrink-0 border-t border-white/[0.07] pb-7 pt-2.5">
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} className="relative flex-1 text-center">
          <span className={`text-[10.5px] ${tab === t.key ? 'text-[#E6B94D]' : 'text-[#5F5F5F]'}`} style={MONO}>{t.label}</span>
          {t.key === 'inbox' && badge > 0 && (
            <span className="absolute -top-[3px] right-[14px] rounded-full px-[5px] text-[8.5px] font-bold text-[#0A0A0A]" style={{ background: GOLD, ...MONO }}>
              {badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = status === 'broken' || status === 'contradicted' ? NEG
    : status === 'weakening' || status === 'watch' ? GOLD
    : status === 'intact' || status === 'confirmed' ? POS : '#5F5F5F';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: c }} />
      <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: c, ...MONO }}>{status}</span>
    </span>
  );
}

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`m-0 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A] ${className}`} style={MONO}>
      {children}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 pt-16 text-center text-[13px] leading-[1.6] text-[#5F5F5F]">{children}</p>;
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[10px] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.028)' }}>
      <p className="m-0 text-[13px] text-[#E8E8E8]" style={MONO}>{v}</p>
      <p className="m-0 mt-0.5 text-[9.5px] uppercase tracking-[0.1em] text-[#6A6A6A]" style={MONO}>{k}</p>
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
