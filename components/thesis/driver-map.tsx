// Driver strip + openable Constellation web for /dashboard/theses (Coexist A).
// Collapsed: a one-row strip of shared-driver chips (always-visible insight).
// Expanded: the Constellation (design language 04) — a clean hub-and-spoke web, laid
// out wide and short. Drivers are gold hubs spread across the width (the most-connected
// one centered to keep lines short); each hub's positions fan above it; faint straight
// lines tie them together; bridges ride between the hubs they share; positions with no
// shared driver sit in a quiet row below. Circles + straight lines only. Deterministic,
// dependency-free.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_META, type PillarStatus } from '@/lib/thesis-palette';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const EDGE = 'rgba(255,255,255,0.14)'; // faint white spoke (--bd-strong), no gold shout
const LOGO_TOKEN = process.env.NEXT_PUBLIC_LOGODEV_TOKEN;

interface ClusterPillar { ticker: string; claim: string; pillarId: string }
export interface Cluster { driver: string; pillars: ClusterPillar[]; rationale: string }

export interface NodeInfo {
  status: PillarStatus | null;
  intact: number;
  total: number;
  weight?: number;
}

function nodeColor(status: PillarStatus | null): string {
  if (!status || status === 'unverified') return '#6A6A6A';
  return STATUS_META[status].color;
}

function wrapDriver(s: string, maxLen = 18): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > maxLen && cur) { lines.push(cur); cur = w; } else { cur = t; }
  }
  if (cur) lines.push(cur);
  // Hard cap at 3 bounded lines. The old version joined everything after line 1
  // into ONE unbounded line, which overflowed the label pill and the viewBox.
  if (lines.length > 3) {
    const last = `${lines[2]} ${lines.slice(3).join(' ')}`;
    lines.length = 2;
    lines.push(last.length > maxLen ? `${last.slice(0, maxLen - 1).trimEnd()}…` : last);
  }
  return lines;
}

/** Label pill metrics — ONE formula for layout bounds, collision and render.
 *  12px uppercase mono runs ~7.4px/char. */
function pillMetrics(lines: string[]) {
  const wMax = Math.max(...lines.map((l) => l.length));
  return { pw: wMax * 7.4 + 18, ph: lines.length * 14 + 8 };
}

interface WebHub { x: number; y: number; labelX: number; lines: string[] }
interface WebNode { x: number; y: number; r: number; status: PillarStatus | null; intact: number; total: number; bridge: boolean }
interface WebEdge { x1: number; y1: number; x2: number; y2: number; bridge: boolean }

// Wide, short radial web: hubs spread across the width (most-connected centered),
// each hub's solo positions fan upward, bridges ride between their hubs, all scaled
// to fill the horizontal space.
function layoutWeb(
  clusters: Cluster[],
  clusterTickers: string[][],
  nodes: Record<string, NodeInfo>,
  W: number,
  H: number,
) {
  const reserveBottom = 54;
  const webH = H - reserveBottom;
  // Hubs pinned near the bottom: all the vertical room goes to the groups above
  // them. (At 0.6*webH everything compressed into the middle band and read as
  // clutter while half the canvas sat empty.)
  const cy = webH - 56;
  const K = clusters.length;

  // ticker -> sorted cluster indices
  const setOf = new Map<string, number[]>();
  clusterTickers.forEach((tks, ci) => {
    for (const t of tks) {
      const u = t.toUpperCase();
      if (!setOf.has(u)) setOf.set(u, []);
      if (!setOf.get(u)!.includes(ci)) setOf.get(u)!.push(ci);
    }
  });
  for (const s of setOf.values()) s.sort((a, b) => a - b);

  // Two-layer "neural network" layout: tickers are the input layer (top row),
  // drivers are the output layer (bottom row), straight edges between. Every
  // line unambiguously runs ticker -> driver; a shared name is simply a ticker
  // with 2-3 fanning edges. Barycenter sweeps order both layers so edges run
  // as parallel as possible (minimal crossings).
  const clustered = [...setOf.keys()].sort();
  const nT = clustered.length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  let driverOrder = clusters.map((_, i) => i).sort((a, b) => clusterTickers[b].length - clusterTickers[a].length || a - b);
  let tickerOrder = clustered;
  for (let sweep = 0; sweep < 2; sweep++) {
    const dSlot = new Map(driverOrder.map((d, s) => [d, s]));
    tickerOrder = [...tickerOrder].sort(
      (a, b) => avg((setOf.get(a) ?? []).map((d) => dSlot.get(d) ?? 0)) - avg((setOf.get(b) ?? []).map((d) => dSlot.get(d) ?? 0)) || (a < b ? -1 : 1),
    );
    const tSlot = new Map(tickerOrder.map((t, s) => [t, s]));
    driverOrder = [...driverOrder].sort(
      (a, b) =>
        avg(clusterTickers[a].map((t) => tSlot.get(t.toUpperCase()) ?? 0)) -
          avg(clusterTickers[b].map((t) => tSlot.get(t.toUpperCase()) ?? 0)) || a - b,
    );
  }
  const tickerSlot = new Map(tickerOrder.map((t, s) => [t, s]));
  const driverSlot = new Map(driverOrder.map((d, s) => [d, s]));

  const padX = 74;
  const ty = 58; // ticker layer baseline
  const tX = (s: number) => (nT <= 1 ? W / 2 : padX + (s / (nT - 1)) * (W - 2 * padX));
  const hubPad = padX + 70; // drivers slightly inset so edge fans stay inward
  const hX = (s: number) => (K <= 1 ? W / 2 : hubPad + (s / (K - 1)) * (W - 2 * hubPad));
  const rawHub = clusters.map((_, i) => ({ x: hX(driverSlot.get(i) ?? 0), y: cy }));

  const maxW = Math.max(1, ...Object.values(nodes).map((n) => n.weight ?? 0));
  const nodeR = (t: string) => { const w = nodes[t.toUpperCase()]?.weight ?? 0; return 22 + 9 * (w / maxW); };
  const meta = (t: string) => { const n = nodes[t.toUpperCase()]; return { status: n?.status ?? null, intact: n?.intact ?? 0, total: n?.total ?? 0 }; };

  const groups = new Map<string, string[]>();
  for (const [t, s] of setOf) { const k = s.join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }

  // Input layer: every clustered ticker on one evenly spaced top row. Radii cap
  // at the slot pitch so neighbours can never touch — no collision passes at all.
  const slotPitch = nT > 1 ? (W - 2 * padX) / (nT - 1) : W;
  const rCap = Math.max(15, Math.min(30, slotPitch / 2 - 7));
  const raw = new Map<string, { x: number; y: number; r: number; status: PillarStatus | null; intact: number; total: number; bridge: boolean }>();
  for (const t of clustered) {
    const s = setOf.get(t) ?? [];
    raw.set(t, {
      x: tX(tickerSlot.get(t) ?? 0),
      y: ty,
      r: Math.min(nodeR(t), rCap),
      ...meta(t),
      bridge: s.length > 1,
    });
  }
  void groups; // membership grouping is expressed by edge fan-out in this layout

  // fit hubs (+ label room) and nodes into the web band, filling the width
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number, r: number) => { minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r); };
  rawHub.forEach((h, i) => {
    acc(h.x, h.y, 14);
    // reserve the REAL label pill footprint, not a token 8px circle — undersized
    // bounds let edge hubs' labels scale outside the viewBox and clip.
    const { pw, ph } = pillMetrics(wrapDriver(clusters[i].driver));
    acc(h.x, h.y + 13 + ph / 2, Math.max(pw / 2, ph / 2));
  });
  raw.forEach((n) => acc(n.x, n.y, n.r + 4));
  const sidePad = 36, padTop = 18, padBot = 16;
  const sc = Math.min((W - 2 * sidePad) / Math.max(1, maxX - minX), (webH - padTop - padBot) / Math.max(1, maxY - minY), 1.15);
  const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = padTop - minY * sc + ((webH - padTop - padBot) - (maxY - minY) * sc) / 2;
  const fit = (x: number, y: number) => ({ x: x * sc + ox, y: y * sc + oy });

  const hubs: WebHub[] = rawHub.map((h, i) => {
    const f = fit(h.x, h.y);
    const lines = wrapDriver(clusters[i].driver);
    const { pw } = pillMetrics(lines);
    // clamp the pill fully inside the viewBox; the gold dot stays on the hub
    const labelX = Math.min(Math.max(f.x, pw / 2 + 4), W - pw / 2 - 4);
    return { x: f.x, y: f.y, labelX, lines };
  });
  const nodePos = new Map<string, WebNode>();
  for (const [t, n] of raw) { const f = fit(n.x, n.y); nodePos.set(t, { x: f.x, y: f.y, r: n.r * sc, status: n.status, intact: n.intact, total: n.total, bridge: n.bridge }); }

  // Keep position circles off the hub label pills. Labels are fixed-size text, so
  // this must run AFTER fit — the raw-space relax pass can't see them, which is
  // how a node ended up sitting on "Data center and semiconductor demand".
  const labelBoxes = hubs.map((h) => {
    const { pw, ph } = pillMetrics(h.lines);
    return { x1: h.labelX - pw / 2, x2: h.labelX + pw / 2, y1: h.y + 13, y2: h.y + 13 + ph };
  });
  for (let pass = 0; pass < 16; pass++) {
    let moved = false;
    for (const n of nodePos.values()) {
      for (const b of labelBoxes) {
        const cx = Math.max(b.x1, Math.min(n.x, b.x2));
        const cyq = Math.max(b.y1, Math.min(n.y, b.y2));
        const d = Math.hypot(n.x - cx, n.y - cyq);
        const clear = n.r + 7;
        if (d < clear) {
          n.y += (n.y < (b.y1 + b.y2) / 2 ? -1 : 1) * (clear - d + 1);
          moved = true;
        }
      }
      if (n.y < n.r + 4) n.y = n.r + 4; // never above the viewBox top
    }
    if (!moved) break;
  }

  const edges: WebEdge[] = [];
  for (const [t, s] of setOf) {
    const n = nodePos.get(t);
    if (!n) continue;
    for (const hi of s) edges.push({ x1: hubs[hi].x, y1: hubs[hi].y, x2: n.x, y2: n.y, bridge: s.length > 1 });
  }

  const standalones = [...new Set(Object.keys(nodes).map((t) => t.toUpperCase()))].filter((t) => !setOf.has(t)).sort();
  return { hubs, nodePos, edges, standalones, dividerY: webH + 4, rowY: webH + reserveBottom / 2 + 3 };
}

export function DriverMap({ nodes }: { nodes: Record<string, NodeInfo> }) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await fetch('/api/thesis/synthesis');
        if (!mountedRef.current) return;
        const data = res.ok ? ((await res.json()) as { clusters?: Cluster[] }) : { clusters: [] };
        if (mountedRef.current) setClusters(Array.isArray(data.clusters) ? data.clusters : []);
      } catch {
        if (mountedRef.current) setClusters([]);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  if (!clusters || clusters.length === 0) return null;

  const clusterTickers = clusters.map((c) => [...new Set(c.pillars.map((p) => p.ticker.toUpperCase()))]);

  return (
    <section className="rounded-lg border border-white/[0.07] bg-[#131313] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] shrink-0" style={MONO}>
          How your theses connect
        </span>
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap flex-1 min-w-0">
          {clusters.map((c, i) => (
            <span key={`${c.driver}-${i}`} className="inline-flex items-center gap-2 text-[15px] text-[#B4B4B4]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-gold)', boxShadow: '0 0 8px rgba(230,185,77,0.7)' }} />
              <span className="truncate max-w-[340px]" title={c.driver}>{c.driver}</span>
              <span className="font-mono text-[15px] font-semibold text-[#FAFAFA]" style={MONO}>{clusterTickers[i].length}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 font-mono text-[13.5px] tracking-[0.06em] rounded px-3.5 py-1.5 border transition-colors hover:brightness-110"
          style={{ ...MONO, color: '#E6B94D', borderColor: 'rgba(230,185,77,0.25)', background: 'rgba(230,185,77,0.06)' }}
          aria-expanded={open}
        >
          {open ? 'Hide map' : 'Map'}
        </button>
      </div>

      {open && <Constellation clusters={clusters} clusterTickers={clusterTickers} nodes={nodes} />}
    </section>
  );
}

export function Constellation({
  clusters,
  clusterTickers,
  nodes,
}: {
  clusters: Cluster[];
  clusterTickers: string[][];
  nodes: Record<string, NodeInfo>;
}) {
  const W = 1000;
  const H = 340;
  const [failedLogos, setFailedLogos] = useState<Set<string>>(() => new Set());
  const layoutKey = JSON.stringify({ c: clusterTickers, t: Object.keys(nodes).sort() });
  const { hubs, nodePos, edges, standalones, dividerY, rowY } = useMemo(
    () => layoutWeb(clusters, clusterTickers, nodes, W, H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );

  const standaloneGap = standalones.length > 0 ? Math.min(104, (W - 130) / Math.max(1, standalones.length)) : 0;
  const standaloneStart = (W - standaloneGap * (standalones.length - 1)) / 2;

  return (
    <div className="border-t border-white/[0.05] px-3 py-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }} role="img" aria-label="Shared-driver web of your theses">
        {/* spokes: faint straight lines, driver hub to each position it ties together */}
        {edges.map((e, i) => (
          <line key={`e-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={EDGE} strokeWidth={e.bridge ? 1.5 : 1.25} opacity={e.bridge ? 0.9 : 0.6} />
        ))}

        {/* hubs: gold dot + glow, labelled pill below */}
        {hubs.map((h, i) => {
          // pillMetrics is the same formula the layout used for bounds + node
          // clearance, so what renders is exactly what was reserved.
          const { pw, ph } = pillMetrics(h.lines);
          return (
            <g key={`h-${i}`}>
              <circle cx={h.x} cy={h.y} r={8} fill="#E6B94D" style={{ filter: 'drop-shadow(0 0 10px rgba(230,185,77,0.9))' }} />
              <rect x={h.labelX - pw / 2} y={h.y + 13} width={pw} height={ph} rx={3} fill="#0A0A0A" stroke="rgba(230,185,77,0.20)" strokeWidth={1} />
              {h.lines.map((ln, k) => (
                <text key={k} x={h.labelX} y={h.y + 13 + 14 + k * 14} textAnchor="middle" fontSize={12} fill="#FFD67A" fontFamily="var(--font-mono)" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {ln}
                </text>
              ))}
            </g>
          );
        })}

        {/* positions: company logo in a status-colour ring; ticker label as the fallback */}
        {[...nodePos.entries()].map(([t, n]) => {
          const col = nodeColor(n.status);
          const glow = n.status && n.status !== 'unverified';
          const showLogo = !!LOGO_TOKEN && !failedLogos.has(t);
          const lr = n.r - 2.5;
          return (
            <g key={`n-${t}`}>
              {n.bridge && <circle cx={n.x} cy={n.y} r={n.r + 4.5} fill="none" stroke="rgba(230,185,77,0.5)" strokeWidth={1.25} />}
              {showLogo ? (
                <>
                  <clipPath id={`logoclip-${t}`}><circle cx={n.x} cy={n.y} r={lr} /></clipPath>
                  <circle cx={n.x} cy={n.y} r={lr} fill="#0E0E0E" />
                  <image
                    href={`https://img.logo.dev/ticker/${encodeURIComponent(t)}?token=${LOGO_TOKEN}&size=${Math.min(800, Math.round(lr * 6))}&format=png&theme=dark&fallback=404`}
                    x={n.x - lr}
                    y={n.y - lr}
                    width={lr * 2}
                    height={lr * 2}
                    clipPath={`url(#logoclip-${t})`}
                    preserveAspectRatio="xMidYMid meet"
                    onError={() => setFailedLogos((prev) => { const s = new Set(prev); s.add(t); return s; })}
                  />
                  <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke={col} strokeWidth={2.5} style={glow ? { filter: `drop-shadow(0 0 9px ${col}59)` } : undefined} />
                </>
              ) : (
                <>
                  <circle cx={n.x} cy={n.y} r={n.r} fill="#0E0E0E" stroke={col} strokeWidth={2} style={glow ? { filter: `drop-shadow(0 0 9px ${col}59)` } : undefined} />
                  <text x={n.x} y={n.total > 0 ? n.y - 1 : n.y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#FAFAFA" fontFamily="var(--font-mono)">{t}</text>
                  {n.total > 0 && (
                    <text x={n.x} y={n.y + 13} textAnchor="middle" fontSize={10} fill={glow ? col : '#8A8A8A'} fontFamily="var(--font-mono)">{n.intact}/{n.total}</text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* positions with no shared driver: a quiet row, no spokes */}
        {standalones.length > 0 && (
          <>
            <line x1={36} y1={dividerY} x2={W - 36} y2={dividerY} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={36} y={rowY - 20} fontSize={11} fill="#6A6A6A" fontFamily="var(--font-mono)" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              No shared driver
            </text>
            {standalones.map((t, i) => {
              const col = nodeColor(nodes[t]?.status ?? null);
              const x = standaloneStart + i * standaloneGap;
              return (
                <g key={`s-${t}`} opacity={0.82}>
                  <circle cx={x} cy={rowY} r={5.5} fill={col} />
                  <text x={x} y={rowY + 20} textAnchor="middle" fontSize={11.5} fill="#9A9A9A" fontFamily="var(--font-mono)">{t}</text>
                </g>
              );
            })}
          </>
        )}
      </svg>

      <div className="flex items-center gap-5 px-2 mt-3 flex-wrap">
        {([['#4ADE80', 'Intact'], ['#E6B94D', 'Weakening'], ['#F87171', 'Broken'], ['#6A6A6A', 'Watching']] as const).map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-2 font-mono text-[13px] text-[#8A8A8A]" style={MONO}>
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <p className="font-mono text-[13px] text-[#5A5A5A] mt-2 px-2" style={MONO}>
        Each gold hub is a shared driver; a line ties it to every position that depends on it. A position on two hubs (gold ring) rides both. Size = weight.
      </p>
    </div>
  );
}
