'use client';

// Lab · Helm on a phone.
//
// The TERMINAL at iPhone size, on the account picked in the lab sidebar.
// Everything is live data. Nothing is seeded, and nothing is drawn that isn't
// backed by a real value — no decorative sparklines standing in for price
// history the API doesn't return.
//
// DENSITY RULE. An earlier pass showed everything at uniform weight and clipped
// each item with an ellipsis, which reads as too much and not enough at once:
// many items, none of them finished. So the surface shows FEWER things, and
// every one of them opens into the whole record on a single tap. Nothing is
// more than one tap from its full detail, and no screen truncates what it
// chose to show.
//
// Copy discipline: Helm reports the distance between a rule the USER adopted
// and where their book sits. "NVDA is 31%, your cap is 20%" is arithmetic.
// "Trim NVDA" is advice, and advice needs a license we don't have.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Newspaper, Layers, Inbox, Crosshair, Landmark, X, ChevronRight } from 'lucide-react';

const SANS = { fontFamily: 'var(--font-sans)' } as const;
const MONO = { fontFamily: 'var(--font-mono)' } as const;

// Hero figures. A trading surface sets its numbers in the same grotesk it sets
// everything else in — tight, heavy, tabular. Two typefaces on screen: Inter
// for language, Space Grotesk for data.
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

/** The full record behind anything on screen. One tap, never truncated. */
interface SheetData {
  kicker: string;
  title: string;
  chip?: string;
  chipColor?: string;
  body?: string;
  rows?: [string, string][];
  foot?: string;
  link?: { label: string; url: string };
}
type Open = (s: SheetData) => void;

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
  return t >= 0 ? `rgba(74, 222, 128, ${0.18 + t * 0.62})` : `rgba(248, 113, 113, ${0.18 + -t * 0.62})`;
}

interface Finding { id: string; title: string; body: string; foot?: string; severity: 'high' | 'med' | 'low' }

/* ── Visual directions ────────────────────────────────────────────────────
   Three languages for the same data, so the choice gets made by looking
   rather than by describing. Each has an actual lineage:

   TERMINAL   Where it stands now. Elevated cards, gold used freely, generous
              radii. Reads modern and app-like; the risk is that "dark card
              with a colored accent" is the most-generated look on earth.
   INSTRUMENT Braun / Vignelli. No card ever. Hairline rules, tight grid, one
              accent used once per screen, numbers carry all the weight.
              Reads as a professional tool, not an app.
   DISPATCH   Broadsheet. Helm as a publication rather than a dashboard.
              Big type, real whitespace, findings read as filed reports.
              Fewer objects, each one larger. */

type Variant = 'terminal' | 'instrument' | 'dispatch';

interface Theme {
  label: string;
  note: string;
  card: (accent?: string) => React.CSSProperties;
  cardClass: string;
  hero: number;
  heroWeight: number;
  kicker: React.CSSProperties;
  kickerClass: string;
  rule: 'hairline' | 'label' | 'heavy';
  pad: string;
  /** Gold on structural chrome, or reserved for the single most important thing. */
  accentChrome: boolean;
}

const THEMES: Record<Variant, Theme> = {
  terminal: {
    label: 'Terminal',
    note: 'Elevated cards, gold throughout. Where it stands now.',
    card: accent => ({
      background: 'linear-gradient(rgba(255,255,255,0.052), rgba(255,255,255,0.022))',
      border: '1px solid rgba(255,255,255,0.065)',
      ...(accent ? { borderLeft: `2px solid ${accent}` } : {}),
    }),
    cardClass: 'mb-2.5 rounded-[13px] px-4 py-3.5',
    hero: 44, heroWeight: 600,
    kicker: { color: 'rgba(230,185,77,0.85)' },
    kickerClass: 'text-[10px] font-medium uppercase tracking-[0.13em]',
    rule: 'label', pad: 'px-6', accentChrome: true,
  },
  instrument: {
    label: 'Instrument',
    note: 'No cards. Hairlines, tight grid, one accent per screen.',
    card: accent => ({
      background: 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      ...(accent ? { borderLeft: `2px solid ${accent}`, paddingLeft: 11 } : {}),
    }),
    cardClass: 'mb-0 px-0 py-4',
    hero: 40, heroWeight: 500,
    kicker: { color: '#6A6A6A' },
    kickerClass: 'text-[9px] font-semibold uppercase tracking-[0.22em]',
    rule: 'hairline', pad: 'px-5', accentChrome: false,
  },
  dispatch: {
    label: 'Dispatch',
    note: 'Broadsheet. Big type, real whitespace, fewer objects.',
    card: accent => ({
      background: 'transparent',
      borderTop: `1px solid ${accent ?? 'rgba(255,255,255,0.12)'}`,
    }),
    cardClass: 'mb-0 px-0 pb-7 pt-4',
    hero: 54, heroWeight: 500,
    kicker: { color: '#8A8A8A' },
    kickerClass: 'text-[11px] font-normal tracking-[0.02em]',
    rule: 'heavy', pad: 'px-7', accentChrome: false,
  },
};

const ThemeCtx = createContext<Theme>(THEMES.terminal);
const useTheme = () => useContext(ThemeCtx);

/* ── First-run flows ──────────────────────────────────────────────────────
   Both open on the same scan and the same verbatim receipt. They differ only
   in what they ask for at the end — which is the step the web funnel says
   loses 20 of 39 people.

   CONNECT  the web flow, ported: scan -> profile -> connect a brokerage.
            Asks for credentials before Helm has proved anything.
   WATCH    only possible on a phone. Push means Helm can be USEFUL with zero
            credentials, so the brokerage leaves onboarding entirely: scan ->
            add two more names -> turn on notifications -> a working app. The
            credential ask becomes an earned upgrade after Helm has actually
            caught something, instead of a gate before it has caught anything. */

type Flow = 'connect' | 'watch';

const FLOWS: Record<Flow, { label: string; note: string }> = {
  connect: { label: 'Connect-first', note: 'Scan → profile → brokerage. The web flow, ported.' },
  watch:   { label: 'Watchlist-first', note: 'Scan → watchlist → push. No credentials at all.' },
};

export function PhoneAppMock({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('brief');
  const [profile, setProfile] = useState<ProfileKey>('moderate');
  const [view, setView] = useState<'onboard' | 'app' | 'lock'>('onboard');
  const [variant, setVariant] = useState<Variant>('terminal');
  const [flow, setFlow] = useState<Flow>('connect');
  const [sheet, setSheet] = useState<SheetData | null>(null);
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
  const open: Open = s => setSheet(s);

  return (
    <ThemeCtx.Provider value={THEMES[variant]}>
    <div className="flex flex-wrap items-start gap-9">
      <style>{`
        @keyframes hmRise { from { opacity:0; transform:translateY(9px) } to { opacity:1; transform:none } }
        @keyframes hmFade { from { opacity:0 } to { opacity:1 } }
        @keyframes hmGrow { from { transform:scaleX(0) } to { transform:scaleX(1) } }
        @keyframes hmUp   { from { transform:translateY(100%) } to { transform:none } }
        .hm-rise { animation: hmRise .5s cubic-bezier(.16,1,.3,1) both }
        .hm-fade { animation: hmFade .5s ease both }
        .hm-grow { transform-origin:left; animation: hmGrow .7s cubic-bezier(.16,1,.3,1) both }
        .hm-up   { animation: hmUp .34s cubic-bezier(.16,1,.3,1) both }
        .hm-scroll::-webkit-scrollbar { display:none }
        .hm-scroll { scrollbar-width:none }
        .hm-tap { text-align:left; width:100%; transition: background .15s ease }
        .hm-tap:active { background: rgba(255,255,255,0.05) }
      `}</style>

      <Phone>
        {view === 'onboard' ? (
          <Onboarding key={flow} flow={flow} profile={profile} setProfile={setProfile} onDone={() => setView('app')} />
        ) : view === 'lock' ? (
          <LockScreen findings={findings} brief={d.brief} />
        ) : (
          <div className="relative flex h-full flex-col">
            <StatusBar />
            {loading ? (
              <p className="mt-28 text-center text-[12px] uppercase tracking-[0.16em] text-[#4A4A4A] hm-fade" style={MONO}>
                reading your book
              </p>
            ) : (
              <div key={tab} className="hm-scroll flex-1 overflow-y-auto">
                {tab === 'brief'  && <BriefScreen brief={d.brief} open={open} />}
                {tab === 'book'   && <BookScreen holdings={d.holdings} brief={d.brief} open={open} />}
                {tab === 'inbox'  && <InboxScreen findings={findings} profile={profile} setProfile={setProfile} open={open} />}
                {tab === 'theses' && <ThesesScreen theses={d.theses} brief={d.brief} open={open} />}
                {tab === 'taxes'  && <TaxesScreen taxes={d.taxes} open={open} />}
              </div>
            )}
            <TabBar tab={tab} setTab={setTab} badge={findings.length} />
            {sheet && <Sheet data={sheet} onClose={() => setSheet(null)} />}
          </div>
        )}
      </Phone>

      <aside className="w-[330px] min-w-[280px] space-y-5">
        <Panel title="Direction">
          <div className="space-y-1.5">
            {(Object.keys(THEMES) as Variant[]).map(v => {
              const on = variant === v;
              return (
                <button key={v} onClick={() => setVariant(v)}
                  className="w-full rounded px-3 py-2 text-left transition-colors"
                  style={{
                    background: on ? 'rgba(230,185,77,0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? 'rgba(230,185,77,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <p className="m-0 text-[12px] font-semibold" style={{ color: on ? GOLD : '#D8D8D8', ...MONO }}>
                    {THEMES[v].label}
                  </p>
                  <p className="m-0 mt-0.5 text-[10.5px] leading-[1.45] text-[#6A6A6A]">{THEMES[v].note}</p>
                </button>
              );
            })}
          </div>
          <p className="m-0 mt-2.5 text-[11px] leading-[1.55] text-[#6A6A6A]">
            Same data, same copy, three visual languages. Judge on Book and Inbox — density is
            where they actually differ.
          </p>
        </Panel>

        <Panel title="First-run flow">
          <div className="space-y-1.5">
            {(Object.keys(FLOWS) as Flow[]).map(f => {
              const on = flow === f;
              return (
                <button key={f} onClick={() => { setFlow(f); setView('onboard'); }}
                  className="w-full rounded px-3 py-2 text-left transition-colors"
                  style={{
                    background: on ? 'rgba(230,185,77,0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? 'rgba(230,185,77,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <p className="m-0 text-[12px] font-semibold" style={{ color: on ? GOLD : '#D8D8D8', ...MONO }}>
                    {FLOWS[f].label}
                  </p>
                  <p className="m-0 mt-0.5 text-[10.5px] leading-[1.45] text-[#6A6A6A]">{FLOWS[f].note}</p>
                </button>
              );
            })}
          </div>
          <p className="m-0 mt-2.5 text-[11px] leading-[1.55] text-[#6A6A6A]">
            Same scan, same evidence. They differ in what gets asked for at the end — the step
            where 20 of 39 leave on web.
          </p>
        </Panel>

        <Panel title="View">
          <div className="flex gap-1.5">
            {([['onboard', 'First run'], ['app', 'App'], ['lock', 'Lock']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 rounded px-2 py-2 text-[11px] transition-colors ${view === v ? 'text-[#0A0A0A] font-semibold' : 'bg-white/[0.04] text-[#B8B8B8] hover:text-[#FAFAFA]'}`}
                style={{ background: view === v ? GOLD : undefined, ...MONO }}>
                {label}
              </button>
            ))}
          </div>
          <p className="m-0 mt-2.5 text-[11px] leading-[1.55] text-[#6A6A6A]">
            First run is the cold open — no account, no book. Value lands on screen before
            anything is asked for.
          </p>
        </Panel>

        <Panel title={`Rules · ${rules.label}`}>
          <Row k="Max single position" v={`${rules.maxPosition}%`} />
          <Row k="Max sector" v={`${rules.maxSector}%`} />
          <p className="m-0 mt-3 text-[11px] leading-[1.55] text-[#6A6A6A]">
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
          <p className="m-0 mt-3 text-[11px] leading-[1.55] text-[#6A6A6A]">
            Every card taps through to its full record — nothing on a screen is clipped with an
            ellipsis, and nothing is more than one tap from its detail.
          </p>
        </Panel>
      </aside>
    </div>
    </ThemeCtx.Provider>
  );
}

/* ── Brief · the open. Shortest screen in the app. ────────────────────── */

function BriefScreen({ brief, open }: { brief: Any; open: Open }) {
  const t = useTheme();
  if (!brief) return <Empty>No brief for this account yet.</Empty>;
  const p = brief.portfolio ?? {};
  const chg = Number(p.overnightChangePct ?? 0);
  const movers: Any[] = (brief.movers ?? []).slice(0, 3);
  const ti: Any[] = brief.thesisIntelligence ?? [];
  const digest = String(brief.digest ?? '');
  const lede = digest.split(/(?<=\.)\s+/)[0] ?? '';

  return (
    <div className={`${t.pad} pb-6 pt-7`}>
      <Kicker>The Current</Kicker>
      <p className="m-0 mt-3.5 leading-[0.95] hm-rise" style={{ color: INK, ...FIG, fontSize: t.hero, fontWeight: t.heroWeight }}>
        {money(p.totalValue ?? 0)}
      </p>
      <div className="mt-3 flex items-center gap-2 hm-rise" style={{ animationDelay: '60ms' }}>
        <span className="rounded-md px-2 py-[3px] text-[12px] font-semibold tabular-nums"
          style={{ color: tone(chg), background: chg >= 0 ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)', ...MONO }}>
          {pct(chg, 2)}
        </span>
        <span className="text-[12.5px] tabular-nums" style={{ color: tone(chg), ...MONO }}>{signed(p.overnightChange ?? 0)}</span>
        <span className="text-[11.5px] text-[#6A6A6A]" style={MONO}>{p.changeLabel ?? ''}</span>
      </div>

      {/* One sentence. The rest of the digest is a tap away, in full. */}
      {lede && (
        <Tappable delay={120} onClick={() => open({ kicker: 'The Current', title: 'Today’s brief', body: digest, foot: brief.digestGeneratedAt ? `Generated ${new Date(brief.digestGeneratedAt).toLocaleString()}` : undefined })}>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#B4B4B4]" style={SANS}>{lede}</p>
          <More>Read the full brief</More>
        </Tappable>
      )}

      {brief.sectorHeat?.length > 0 && (
        <>
          <Rule label="Sector heat" />
          <button className="hm-tap hm-grow flex h-[26px] overflow-hidden rounded-[6px]" style={{ animationDelay: '180ms' }}
            onClick={() => open({
              kicker: 'Allocation', title: 'Sector heat',
              rows: (brief.sectorHeat as Any[]).map((s: Any) => [s.sector, `${Math.round(s.weight)}%  ${pct(Number(s.changePct ?? 0))}`]),
              foot: 'Width is weight in your book. Color is today’s move.',
            })}>
            {(brief.sectorHeat as Any[]).map((s: Any, i: number) => (
              <span key={i} style={{ width: `${s.weight}%`, background: heatColor(Number(s.changePct ?? 0)) }} />
            ))}
          </button>
        </>
      )}

      {movers.length > 0 && (
        <>
          <Rule label="Movers" />
          {movers.map((m: Any, i: number) => (
            <Tappable key={m.ticker} bare delay={220 + i * 40}
              onClick={() => open({
                kicker: 'Mover', title: m.ticker, chip: pct(Number(m.changePct ?? 0)), chipColor: tone(Number(m.changePct ?? 0)),
                rows: [['Name', String(m.name ?? m.ticker)], ['Sector', String(m.sector ?? '—')],
                       ['Change today', pct(Number(m.changePct ?? 0), 2)], ['On your position', signed(Number(m.dollarImpact ?? 0))]],
              })}>
              <div className="flex items-center gap-3 py-[10px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                <span className="w-[54px] text-[13px] font-semibold" style={{ color: INK, ...MONO }}>{m.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#6A6A6A]" style={SANS}>{m.sector}</span>
                <ChangeBar pctValue={Number(m.changePct ?? 0)} />
                <span className="w-[52px] text-right text-[12.5px] tabular-nums" style={{ color: tone(m.changePct), ...MONO }}>
                  {pct(m.changePct)}
                </span>
              </div>
            </Tappable>
          ))}
        </>
      )}

      {ti.length > 0 && (
        <>
          <Rule label="Needs a look" />
          {ti.slice(0, 2).map((t: Any, i: number) => (
            <Tappable key={i} delay={300 + i * 50}
              onClick={() => open({
                kicker: `Thesis · ${t.ticker}`, title: String(t.pillarClaim ?? t.ticker),
                chip: String(t.verdict ?? ''), chipColor: statusColor(String(t.verdict ?? '')),
                body: [t.why, t.whatItMeans, t.consider].filter(Boolean).join('\n\n'),
                rows: t.materiality ? [['Materiality', String(t.materiality)]] : undefined,
                foot: Array.isArray(t.sources) && t.sources.length ? `${t.sources.length} source${t.sources.length === 1 ? '' : 's'} on file` : undefined,
              })}>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: INK, ...MONO }}>{t.ticker}</span>
                <StatusChip status={String(t.verdict ?? '')} />
              </div>
              {t.whatItMeans && <p className="m-0 mt-2 text-[12.5px] leading-[1.55] text-[#A4A4A4]" style={SANS}>{String(t.whatItMeans)}</p>}
            </Tappable>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Book · three facts, then the list on request. ────────────────────── */

function BookScreen({ holdings, brief, open }: { holdings: Any[]; brief: Any; open: Open }) {
  const t = useTheme();
  const [all, setAll] = useState(false);

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

  if (!rows.length) return <Empty>No positions on this account.</Empty>;

  const total = rows.reduce((s, r) => s + r.value, 0);
  const top = rows[0].value;
  const shown = all ? rows : rows.slice(0, 6);
  const dayPct = Number(brief?.portfolio?.overnightChangePct ?? 0);

  return (
    <div className={`${t.pad} pb-6 pt-7`}>
      <Kicker>Book</Kicker>
      <p className="m-0 mt-3.5 leading-[0.95] hm-rise" style={{ color: INK, ...FIG, fontSize: t.hero, fontWeight: t.heroWeight }}>{money(total)}</p>
      <p className="m-0 mt-2.5 text-[12.5px] tabular-nums hm-rise" style={{ animationDelay: '60ms', color: tone(dayPct), ...MONO }}>
        {pct(dayPct, 2)} <span className="text-[#6A6A6A]">today · {rows.length} positions</span>
      </p>

      <Rule label={all ? 'All positions' : 'Largest'} />
      {shown.map((r, i) => (
        <Tappable key={r.ticker} bare delay={Math.min(i * 20, 340)}
          onClick={() => open({
            kicker: 'Position', title: r.ticker,
            chip: r.pct == null ? undefined : pct(r.pct), chipColor: r.pct == null ? undefined : tone(r.pct),
            rows: [['Value', money(r.value)], ['Weight', `${((r.value / total) * 100).toFixed(2)}%`],
                   ['Sector', r.sector || '—'], ['Change today', r.pct == null ? '—' : pct(r.pct, 2)]],
          })}>
          <div className="py-[10px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-[13.5px] font-semibold" style={{ color: INK, ...MONO }}>{r.ticker}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-[#5F5F5F]" style={SANS}>{r.sector}</span>
              <span className="text-[13px] tabular-nums text-[#E4E4E4]" style={MONO}>{compact(r.value)}</span>
              <span className="w-[50px] text-right text-[11.5px] tabular-nums" style={{ color: r.pct == null ? '#4A4A4A' : tone(r.pct), ...MONO }}>
                {r.pct == null ? '—' : pct(r.pct)}
              </span>
            </div>
            <div className="mt-[7px] flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full hm-grow"
                  style={{ width: `${(r.value / top) * 100}%`, background: `linear-gradient(90deg, ${GOLD}, rgba(230,185,77,0.4))`, animationDelay: `${Math.min(i * 20, 340)}ms` }} />
              </div>
              <span className="w-[36px] text-right text-[10px] tabular-nums text-[#5F5F5F]" style={MONO}>
                {((r.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </Tappable>
      ))}

      {rows.length > 6 && (
        <button onClick={() => setAll(!all)}
          className="mt-4 w-full rounded-[10px] py-2.5 text-[12px] transition-colors hover:text-[#FAFAFA]"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#9A9A9A', ...MONO }}>
          {all ? 'Show largest only' : `All ${rows.length} positions`}
        </button>
      )}
    </div>
  );
}

/* ── Inbox · the one screen where completeness IS the product. ────────── */

function InboxScreen({ findings, profile, setProfile, open }: {
  findings: Finding[]; profile: ProfileKey; setProfile: (p: ProfileKey) => void; open: Open;
}) {
  const t = useTheme();
  const SEV = { high: NEG, med: GOLD, low: '#5A5A5A' } as const;
  const LABEL = { high: 'Attention', med: 'Watch', low: 'Note' } as const;

  return (
    <div className={`${t.pad} pb-6 pt-7`}>
      <Kicker>Inbox</Kicker>
      <p className="m-0 mt-3 max-w-[280px] text-[21px] font-semibold leading-[1.28] tracking-[-0.02em] hm-rise" style={{ color: INK, ...SANS }}>
        {findings.length === 0 ? 'Nothing crossed your lines.' : `${findings.length} thing${findings.length === 1 ? '' : 's'} while you were gone.`}
      </p>

      {/* The profile pick, living where the brokerage ask used to be. Three taps,
          no account needed, and it gives "connect" a reason to exist. */}
      <div className="mb-1 mt-5 flex gap-1.5 hm-fade" style={{ animationDelay: '80ms' }}>
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
        <Tappable key={f.id} delay={110 + i * 50} accent={SEV[f.severity]}
          onClick={() => open({ kicker: LABEL[f.severity], title: f.title, body: f.body, foot: f.foot })}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full" style={{ background: SEV[f.severity] }} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: SEV[f.severity], ...MONO }}>
              {LABEL[f.severity]}
            </span>
          </div>
          <p className="m-0 text-[14.5px] font-semibold leading-[1.35]" style={{ color: INK, ...SANS }}>{f.title}</p>
          <p className="m-0 mt-2 text-[12.5px] leading-[1.6] text-[#A4A4A4]" style={SANS}>{f.body}</p>
          {f.foot && <p className="m-0 mt-2.5 text-[10.5px] leading-[1.45] text-[#5F5F5F]" style={MONO}>{f.foot}</p>}
        </Tappable>
      ))}
    </div>
  );
}

/* ── Theses · intact is noise. Show what moved. ───────────────────────── */

function ThesesScreen({ theses, brief, open }: { theses: Any[]; brief: Any; open: Open }) {
  const t = useTheme();
  const [all, setAll] = useState(false);
  const list = theses ?? [];
  if (!list.length) return <Empty>No theses on this account yet.</Empty>;

  const rank: Record<string, number> = { broken: 0, weakening: 1, unverified: 2, intact: 3 };
  const worst = (t: Any) => Math.min(...((t.pillars ?? []).map((p: Any) => rank[String(p.status)] ?? 3).concat(3)));
  const sorted = [...list].sort((a, b) => worst(a) - worst(b));
  const flagged = sorted.filter(t => worst(t) < 3);
  const shown = all ? sorted : flagged;
  const s = brief?.pillarSummary ?? {};

  return (
    <div className={`${t.pad} pb-6 pt-7`}>
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

      <Rule label={all ? 'All theses' : 'Needs attention'} />
      {shown.length === 0 && (
        <p className="mt-6 text-center text-[13px] leading-[1.65] text-[#5F5F5F]" style={SANS}>
          Every pillar you track is intact.<br />Nothing needs you today.
        </p>
      )}
      {shown.map((t: Any, i: number) => {
        const pillars: Any[] = t.pillars ?? [];
        const lead = pillars.find((p: Any) => p.status === 'broken' || p.status === 'weakening') ?? pillars[0];
        return (
          <Tappable key={t.id} delay={130 + i * 45}
            onClick={() => open({
              kicker: `Thesis · ${t.ticker}`, title: lead?.claim ? String(lead.claim) : String(t.ticker),
              chip: lead ? String(lead.status) : undefined, chipColor: lead ? statusColor(String(lead.status)) : undefined,
              body: lead?.breaks_if ? `Breaks if: ${lead.breaks_if}` : undefined,
              rows: pillars.map((p: Any, n: number) => [`Pillar ${n + 1}`, String(p.status)]),
              foot: `${pillars.length} pillar${pillars.length === 1 ? '' : 's'} tracked`,
            })}>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-bold" style={{ color: INK, ...MONO }}>{t.ticker}</span>
              {lead && <StatusChip status={String(lead.status)} />}
              <span className="ml-auto text-[10px] text-[#5A5A5A]" style={MONO}>{pillars.length} pillars</span>
            </div>
            {lead?.claim && <p className="m-0 mt-2 text-[12px] leading-[1.6] text-[#A4A4A4]" style={SANS}>{String(lead.claim)}</p>}
            <div className="mt-3 flex gap-[3px]">
              {pillars.map((p: Any) => (
                <div key={p.id} className="h-[3px] flex-1 rounded-full" style={{ background: statusColor(String(p.status)) }} />
              ))}
            </div>
          </Tappable>
        );
      })}

      {flagged.length < list.length && (
        <button onClick={() => setAll(!all)}
          className="mt-4 w-full rounded-[10px] py-2.5 text-[12px] transition-colors hover:text-[#FAFAFA]"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#9A9A9A', ...MONO }}>
          {all ? 'Show what needs attention' : `All ${list.length} theses`}
        </button>
      )}
    </div>
  );
}

/* ── Taxes ────────────────────────────────────────────────────────────── */

function TaxesScreen({ taxes, open }: { taxes: Any; open: Open }) {
  const t = useTheme();
  if (!taxes) return <Empty>Tax center needs Pro on this account.</Empty>;
  const ops: Any[] = taxes.opportunities ?? [];
  const cap = taxes.annualCap ?? {};

  return (
    <div className={`${t.pad} pb-6 pt-7`}>
      <Kicker>Estimated tax saved</Kicker>
      <p className="m-0 mt-3.5 leading-[0.95] hm-rise" style={{ color: POS, ...FIG, fontSize: t.hero, fontWeight: t.heroWeight }}>
        {money(taxes.totalEstimatedSavings ?? 0)}
      </p>
      <p className="m-0 mt-2.5 text-[12px] text-[#7A7A7A] hm-rise" style={{ animationDelay: '60ms', ...MONO }}>
        from {money(taxes.totalHarvestableLoss ?? 0)} in harvestable losses
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Mini k="Deduction cap" v={money(cap.annualDeductionCap ?? 0)} delay={110} />
        <Mini k="Carryforward" v={money(cap.estimatedCarryforward ?? 0)} delay={150} />
      </div>

      <Rule label="Positions" />
      {ops.length === 0 && <p className="m-0 text-[12.5px] text-[#5F5F5F]" style={SANS}>Nothing harvestable right now.</p>}
      {ops.map((o: Any, i: number) => (
        <Tappable key={o.ticker} delay={190 + i * 50} accent={POS}
          onClick={() => open({
            kicker: 'Harvest candidate', title: o.ticker, chip: money(o.estimatedSavings ?? 0), chipColor: POS,
            rows: [['Unrealized loss', money(o.unrealizedLoss ?? 0)], ['Current value', money(o.currentValue ?? 0)],
                   ['Cost basis', money(o.costBasis ?? 0)], ['Shares', String(o.shares ?? '—')],
                   ['Holding period', String(o.holdingPeriod ?? 'unclassified').replace('_', '-')],
                   ...(typeof o.daysToLongTerm === 'number' && o.daysToLongTerm > 0 ? [['Days to long-term', String(o.daysToLongTerm)] as [string, string]] : []),
                   ['Effective rate', `${Math.round((o.effectiveTaxRate ?? 0) * 100)}%`]],
            foot: taxes.disclaimer ? String(taxes.disclaimer) : undefined,
          })}>
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-bold" style={{ color: INK, ...MONO }}>{o.ticker}</span>
            <span className="ml-auto text-[16px]" style={{ color: POS, ...FIG }}>{money(o.estimatedSavings ?? 0)}</span>
          </div>
          <p className="m-0 mt-2 text-[12px] leading-[1.55] text-[#A4A4A4]" style={SANS}>
            {money(o.unrealizedLoss ?? 0)} unrealized loss ·{' '}
            {o.holdingPeriod === 'long_term' ? 'long-term' : o.holdingPeriod === 'short_term' ? 'short-term' : 'unclassified'}
          </p>
          {typeof o.daysToLongTerm === 'number' && o.daysToLongTerm > 0 && (
            <div className="mt-2.5">
              <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full hm-grow"
                  style={{ width: `${Math.max(2, 100 - (o.daysToLongTerm / 365) * 100)}%`, background: GOLD, animationDelay: `${190 + i * 50}ms` }} />
              </div>
              <p className="m-0 mt-1.5 text-[10.5px] text-[#6A6A6A]" style={MONO}>{o.daysToLongTerm} days to long-term</p>
            </div>
          )}
        </Tappable>
      ))}
    </div>
  );
}

/* ── Detail sheet · one tap, nothing clipped. ─────────────────────────── */

function Sheet({ data, onClose }: { data: SheetData; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button onClick={onClose} className="absolute inset-0 hm-fade" style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(2px)' }} aria-label="Close" />
      <div className="hm-scroll hm-up relative max-h-[76%] overflow-y-auto rounded-t-[26px] px-6 pb-9 pt-5"
        style={{ background: 'linear-gradient(#17171A, #0D0D0F 42%)', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="mx-auto mb-5 h-[4px] w-[38px] rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        <button onClick={onClose} className="absolute right-5 top-5 grid h-7 w-7 place-items-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)' }} aria-label="Close">
          <X size={13} color="#9A9A9A" />
        </button>

        <Kicker>{data.kicker}</Kicker>
        <div className="mt-2.5 flex items-start gap-2.5">
          <p className="m-0 flex-1 text-[17px] font-semibold leading-[1.4]" style={{ color: INK, ...SANS }}>{data.title}</p>
          {data.chip && (
            <span className="shrink-0 rounded-[5px] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: data.chipColor ?? GOLD, background: `${data.chipColor ?? GOLD}1A`, ...MONO }}>
              {data.chip}
            </span>
          )}
        </div>

        {data.body && (
          <div className="mt-4 space-y-3">
            {data.body.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="m-0 text-[13.5px] leading-[1.68] text-[#B4B4B4]" style={SANS}>{para}</p>
            ))}
          </div>
        )}

        {data.rows && data.rows.length > 0 && (
          <div className="mt-5">
            {data.rows.map(([k, v], i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-[9px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[12.5px] text-[#7A7A7A]" style={SANS}>{k}</span>
                <span className="text-[12.5px] tabular-nums" style={{ color: '#E4E4E4', ...MONO }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {data.foot && <p className="m-0 mt-5 text-[11px] leading-[1.6] text-[#5F5F5F]" style={SANS}>{data.foot}</p>}
      </div>
    </div>
  );
}

/* ── First run · value before the ask. ────────────────────────────────── */

// The web funnel says 95% of people who reach the scan step type a ticker and
// read the card — and then 20 of 39 leave at the brokerage ask. So the cold
// open leads with the catch and earns the ask afterwards: scan a name they
// already care about, put a VERBATIM filing citation with its source and date
// on screen, then ask how they invest, and only then ask for accounts — with a
// reason now attached to it.

const HOUSE_PICKS = ['NVDA', 'TSM', 'AVGO', 'MU', 'META', 'AAPL'];
type Step = 'ask' | 'scanning' | 'catch' | 'profile' | 'connect' | 'watchlist' | 'push';

function Onboarding({ flow, profile, setProfile, onDone }: {
  flow: Flow; profile: ProfileKey; setProfile: (p: ProfileKey) => void; onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('ask');
  const [ticker, setTicker] = useState('');
  const [typed, setTyped] = useState('');
  const [scan, setScan] = useState<Any>(null);
  const [watch, setWatch] = useState<string[]>([]);
  const [addTyped, setAddTyped] = useState('');

  const addWatch = (sym: string) => {
    const t = sym.trim().toUpperCase();
    if (!t || watch.includes(t)) return;
    setWatch(w => [...w, t]);
    setAddTyped('');
  };

  const run = async (sym: string) => {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setStep('scanning');
    try {
      const r = await fetch(`/api/scan/ticker?symbol=${encodeURIComponent(t)}`);
      setScan(r.ok ? await r.json() : null);
    } catch { setScan(null); }
    setWatch([t]);
    setStep('catch');
  };

  return (
    <div className="flex h-full flex-col">
      <StatusBar />

      {step === 'ask' && (
        <div className="flex flex-1 flex-col px-7 pt-20">
          <span className="text-[22px] font-bold tracking-[0.03em]" style={{ color: INK, ...SANS }}>HELM</span>
          <p className="m-0 mt-8 text-[27px] font-semibold leading-[1.22] tracking-[-0.02em] hm-rise" style={{ color: INK, ...SANS }}>
            Name something<br />you own.
          </p>
          <p className="m-0 mt-3 text-[13.5px] leading-[1.6] text-[#8A8A8A] hm-rise" style={{ animationDelay: '80ms', ...SANS }}>
            No account yet. Helm reads the filings and reporting on it, then shows you the
            evidence it found and where it came from.
          </p>

          <div className="mt-7 hm-rise" style={{ animationDelay: '140ms' }}>
            <input value={typed} onChange={e => setTyped(e.target.value.toUpperCase().slice(0, 5))}
              onKeyDown={e => { if (e.key === 'Enter') run(typed); }}
              placeholder="TICKER" spellCheck={false}
              className="w-full rounded-[12px] px-4 py-3.5 text-[17px] tracking-[0.08em] outline-none"
              style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', color: INK, ...MONO }} />
            <button onClick={() => run(typed)} disabled={!typed.trim()}
              className="mt-2.5 w-full rounded-[12px] py-3.5 text-[14px] font-semibold transition-opacity disabled:opacity-30"
              style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
              Scan it
            </button>
          </div>

          <p className="m-0 mb-2.5 mt-8 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>
            or start here
          </p>
          <div className="flex flex-wrap gap-1.5">
            {HOUSE_PICKS.map(t => (
              <button key={t} onClick={() => run(t)}
                className="rounded-full px-3.5 py-[7px] text-[12px] transition-colors hover:text-[#FAFAFA]"
                style={{ background: 'rgba(255,255,255,0.055)', color: '#B0B0B0', ...MONO }}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div className="flex flex-1 flex-col justify-center px-7">
          <p className="m-0 text-[11px] uppercase tracking-[0.18em]" style={{ color: GOLD, ...MONO }}>Scanning {ticker}</p>
          <div className="mt-5 space-y-2.5">
            {['Pulling filings and reporting', 'Reading the source', 'Matching claims to evidence', 'Checking what changed'].map((l, i) => (
              <p key={l} className="m-0 text-[13px] text-[#7A7A7A] hm-fade" style={{ animationDelay: `${i * 260}ms`, ...MONO }}>
                <span style={{ color: POS }}>✓</span> {l}
              </p>
            ))}
          </div>
        </div>
      )}

      {step === 'catch' && (
        <div className="hm-scroll flex-1 overflow-y-auto px-7 pt-8">
          {scan?.house ? (
            <>
              <Kicker>What Helm found</Kicker>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-[26px] font-semibold" style={{ color: INK, ...FIG }}>{scan.ticker}</span>
                <StatusChip status={String(scan.health ?? '')} />
              </div>
              {scan.company && <p className="m-0 mt-1 text-[12.5px] text-[#7A7A7A]" style={SANS}>{scan.company}</p>}

              {scan.pillar?.claim && (
                <p className="m-0 mt-5 text-[15px] leading-[1.55] hm-rise" style={{ color: '#DCDCDC', ...SANS }}>
                  {scan.pillar.claim}
                </p>
              )}

              {scan.receipt?.verbatimCite && (
                <div className="mt-5 rounded-[12px] px-4 py-4 hm-rise" style={{
                  animationDelay: '90ms',
                  background: 'linear-gradient(rgba(230,185,77,0.07), rgba(230,185,77,0.02))',
                  border: '1px solid rgba(230,185,77,0.16)',
                }}>
                  <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(230,185,77,0.9)', ...MONO }}>
                    The receipt
                  </p>
                  <p className="m-0 mt-2.5 text-[13px] leading-[1.65] text-[#E4E4E4]" style={SANS}>
                    “{scan.receipt.verbatimCite}”
                  </p>
                  <p className="m-0 mt-3 text-[10.5px] text-[#8A8A8A]" style={MONO}>
                    {scan.receipt.sourceLabel}{scan.receipt.dateISO ? ` · ${scan.receipt.dateISO}` : ''}
                  </p>
                </div>
              )}

              <p className="m-0 mt-5 text-[12.5px] leading-[1.6] text-[#7A7A7A]" style={SANS}>
                That is one claim on {scan.ticker}, checked against what was actually filed.
                {scan.pillarCount > 1 ? ` Helm tracks ${scan.pillarCount} on this name.` : ''}
              </p>
            </>
          ) : (
            <>
              <Kicker>Watching {ticker}</Kicker>
              <p className="m-0 mt-3 text-[19px] font-semibold leading-[1.35]" style={{ color: INK, ...SANS }}>
                No evidence on {ticker} yet.
              </p>
              <p className="m-0 mt-3 text-[13.5px] leading-[1.65] text-[#8A8A8A]" style={SANS}>
                Helm will not invent one. It watches from here, and the moment something lands
                that bears on it, it reaches you with the quote attached.
              </p>
            </>
          )}

          <button onClick={() => setStep(flow === 'watch' ? 'watchlist' : 'profile')}
            className="mb-7 mt-8 w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
            style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
            Continue
          </button>
        </div>
      )}

      {/* Watchlist-first: no credentials asked for, ever. Push is what makes a
          credential-free product actually work, which is why this flow only
          exists on a phone. */}
      {step === 'watchlist' && (
        <div className="flex flex-1 flex-col px-7 pt-14">
          <Kicker>No account needed</Kicker>
          <p className="m-0 mt-3 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]" style={{ color: INK, ...SANS }}>
            What else should<br />Helm watch?
          </p>
          <p className="m-0 mt-3 text-[13px] leading-[1.6] text-[#8A8A8A]" style={SANS}>
            It reads every one of these the way it just read {ticker}, and tells you when
            something lands.
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {watch.map(w => (
              <span key={w} className="flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[12px]"
                style={{ background: 'rgba(230,185,77,0.13)', color: GOLD, ...MONO }}>
                {w}
                <button onClick={() => setWatch(list => list.filter(x => x !== w))} aria-label={`Remove ${w}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          <input value={addTyped} onChange={e => setAddTyped(e.target.value.toUpperCase().slice(0, 5))}
            onKeyDown={e => { if (e.key === 'Enter') addWatch(addTyped); }}
            placeholder="ADD A TICKER" spellCheck={false}
            className="mt-4 w-full rounded-[12px] px-4 py-3 text-[15px] tracking-[0.08em] outline-none"
            style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', color: INK, ...MONO }} />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {HOUSE_PICKS.filter(t => !watch.includes(t)).slice(0, 5).map(t => (
              <button key={t} onClick={() => addWatch(t)}
                className="rounded-full px-3 py-[6px] text-[11.5px] transition-colors hover:text-[#FAFAFA]"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9A9A9A', ...MONO }}>+ {t}</button>
            ))}
          </div>

          <button onClick={() => setStep('push')} disabled={watch.length < 2}
            className="mb-7 mt-auto w-full rounded-[12px] py-3.5 text-[14px] font-semibold transition-opacity disabled:opacity-30"
            style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
            {watch.length < 2 ? 'Add one more' : `Watch these ${watch.length}`}
          </button>
        </div>
      )}

      {step === 'push' && (
        <div className="flex flex-1 flex-col px-7 pt-16">
          <Kicker>One switch</Kicker>
          <p className="m-0 mt-3 text-[25px] font-semibold leading-[1.28] tracking-[-0.02em]" style={{ color: INK, ...SANS }}>
            Helm reaches you<br />when it finds something.
          </p>
          <p className="m-0 mt-3.5 text-[13.5px] leading-[1.65] text-[#8A8A8A]" style={SANS}>
            Not a daily digest, not a market recap. A notification only when evidence lands on
            one of your {watch.length} names, with the quote attached.
          </p>

          <div className="mt-6 rounded-[18px] px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[9px] font-bold text-[#0A0A0A]"
                style={{ background: `linear-gradient(135deg, #FFD67A, ${GOLD})` }}>H</div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#D2D2D2]" style={MONO}>Helm</span>
              <span className="ml-auto text-[10.5px] text-[#8A8A8A]" style={SANS}>now</span>
            </div>
            <p className="m-0 text-[13px] leading-[1.45]" style={{ color: INK, ...SANS }}>
              {watch[0]} — a filing contradicts one of the claims Helm tracks on it.
            </p>
          </div>
          <p className="m-0 mt-2 text-[10.5px] text-[#5F5F5F]" style={MONO}>what one looks like</p>

          <div className="mb-7 mt-auto">
            <button onClick={onDone} className="w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
              style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
              Turn on notifications
            </button>
            <button onClick={onDone} className="mt-2 w-full py-2.5 text-[12.5px]" style={{ color: '#7A7A7A', ...SANS }}>
              Not yet
            </button>
            <p className="m-0 mt-3 text-center text-[11px] leading-[1.5] text-[#5F5F5F]" style={SANS}>
              Connect a brokerage whenever you want. Helm works without one.
            </p>
          </div>
        </div>
      )}

      {step === 'profile' && (
        <div className="flex flex-1 flex-col px-7 pt-16">
          <Kicker>Two taps</Kicker>
          <p className="m-0 mt-3 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]" style={{ color: INK, ...SANS }}>
            How do you invest?
          </p>
          <p className="m-0 mt-3 text-[13px] leading-[1.6] text-[#8A8A8A]" style={SANS}>
            Sets the lines Helm measures your book against. Change it whenever you like.
          </p>

          <div className="mt-6 space-y-2">
            {(Object.keys(PROFILES) as ProfileKey[]).map((k, i) => {
              const on = profile === k;
              return (
                <button key={k} onClick={() => setProfile(k)}
                  className="hm-tap hm-rise rounded-[12px] px-4 py-3.5"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: on ? 'rgba(230,185,77,0.10)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? 'rgba(230,185,77,0.42)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <p className="m-0 text-[14.5px] font-semibold" style={{ color: on ? GOLD : INK, ...SANS }}>
                    {PROFILES[k].label}
                  </p>
                  <p className="m-0 mt-1 text-[11.5px] text-[#7A7A7A]" style={MONO}>
                    max {PROFILES[k].maxPosition}% in one name · {PROFILES[k].maxSector}% in one sector
                  </p>
                </button>
              );
            })}
          </div>

          <button onClick={() => setStep('connect')}
            className="mb-7 mt-auto w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
            style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
            Continue
          </button>
        </div>
      )}

      {step === 'connect' && (
        <div className="flex flex-1 flex-col px-7 pt-16">
          <Kicker>Last step</Kicker>
          <p className="m-0 mt-3 text-[25px] font-semibold leading-[1.28] tracking-[-0.02em]" style={{ color: INK, ...SANS }}>
            Helm is watching {ticker}.<br />Give it the rest.
          </p>
          <p className="m-0 mt-3.5 text-[13.5px] leading-[1.65] text-[#8A8A8A]" style={SANS}>
            Connect your brokerages and it reads every position you hold the same way, against
            the {PROFILES[profile].label.toLowerCase()} lines you just set.
          </p>

          <div className="mt-6 space-y-2.5">
            {[
              'Read-only. Helm can never trade or move money.',
              'Every finding arrives with the quote it came from.',
              'Disconnect in one tap, any time.',
            ].map((l, i) => (
              <p key={l} className="m-0 flex gap-2.5 text-[12.5px] leading-[1.5] text-[#9A9A9A] hm-rise"
                style={{ animationDelay: `${i * 70}ms`, ...SANS }}>
                <span style={{ color: POS }}>✓</span>{l}
              </p>
            ))}
          </div>

          <div className="mb-7 mt-auto">
            <button onClick={onDone} className="w-full rounded-[12px] py-3.5 text-[14px] font-semibold"
              style={{ background: GOLD, color: '#0A0A0A', ...SANS }}>
              Connect accounts
            </button>
            <button onClick={onDone} className="mt-2 w-full py-2.5 text-[12.5px]" style={{ color: '#7A7A7A', ...SANS }}>
              Look around first
            </button>
          </div>
        </div>
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
      <div className="pb-10 pt-16 text-center hm-fade">
        <p className="m-0 text-[15px] text-[#9A9A9A]" style={SANS}>Thursday, August 6</p>
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
      <p className="mb-9 mt-auto text-center text-[10.5px] tracking-[0.1em] text-[#3F3F3F]" style={MONO}>
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
      <div className="pointer-events-none absolute -inset-16 -z-10"
        style={{ background: 'radial-gradient(50% 40% at 50% 30%, rgba(230,185,77,0.10), transparent 70%)' }} />
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
          <div className="absolute left-1/2 top-[10px] z-50 -translate-x-1/2"
            style={{ width: 120, height: 34, borderRadius: 20, background: '#000' }} />
          <div className="pointer-events-none absolute inset-0 z-[45]"
            style={{ background: 'linear-gradient(158deg, rgba(255,255,255,0.045) 0%, transparent 26%)' }} />
          <div className="flex h-full w-full flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-8 pb-1 pt-3.5">
      <span className="text-[14px] font-semibold" style={{ color: INK, ...SANS }}>9:41</span>
      <span className="flex items-center gap-[5px]">
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: INK }} />)}
        </span>
        <span style={{ width: 22, height: 11, borderRadius: 3, border: '1px solid rgba(250,250,250,0.5)', padding: 1.5, display: 'inline-block' }}>
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
          <button key={key} onClick={() => setTab(key)} className="relative flex flex-1 flex-col items-center gap-[5px] pt-1.5 transition-colors">
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

/** Everything on a screen is one of these: a tap target onto its full record. */
function Tappable({ children, onClick, delay = 0, accent, bare }: {
  children: React.ReactNode; onClick: () => void; delay?: number; accent?: string; bare?: boolean;
}) {
  const t = useTheme();
  return (
    <button onClick={onClick} className={`hm-tap hm-rise ${bare ? '' : t.cardClass}`}
      style={{ animationDelay: `${delay}ms`, ...(bare ? {} : t.card(accent)) }}>
      {children}
    </button>
  );
}

function More({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-2.5 inline-flex items-center gap-1 text-[11px]" style={{ color: 'rgba(230,185,77,0.9)', ...MONO }}>
      {children}<ChevronRight size={11} />
    </span>
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

function statusColor(status: string): string {
  return status === 'broken' || status === 'contradicted' ? NEG
    : status === 'weakening' || status === 'watch' ? GOLD
    : status === 'intact' || status === 'confirmed' ? POS : '#3A3A3A';
}

function StatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span className="rounded-[4px] px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.11em]"
      style={{ color: c, background: `${c}1A`, ...MONO }}>{status}</span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <p className={`m-0 hm-fade ${t.kickerClass}`} style={{ ...t.kicker, ...MONO }}>{children}</p>
  );
}

function Rule({ label }: { label: string }) {
  const t = useTheme();
  if (t.rule === 'hairline') {
    return (
      <div className="mb-2.5 mt-6 flex items-baseline justify-between border-b pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <span className="text-[8.5px] font-semibold uppercase tracking-[0.24em] text-[#7A7A7A]" style={MONO}>{label}</span>
      </div>
    );
  }
  if (t.rule === 'heavy') {
    return (
      <p className="m-0 mb-4 mt-9 text-[17px] font-semibold tracking-[-0.01em]" style={{ color: INK, ...SANS }}>{label}</p>
    );
  }
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
