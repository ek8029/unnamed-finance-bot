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

function wrapDriver(s: string, maxLen = 20): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > maxLen && cur) { lines.push(cur); cur = w; } else { cur = t; }
  }
  if (cur) lines.push(cur);
  return lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines;
}

interface WebHub { x: number; y: number; lines: string[] }
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
  const cy = webH * 0.6; // hub baseline; positions fan up, labels sit below
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

  // hubs on evenly spaced horizontal slots; the most-bridged hub takes the centre slot
  // (center-out assignment) so cross-hub lines stay short.
  const padX = 84;
  const slotX = (k: number) => (K <= 1 ? W / 2 : padX + ((k + 0.5) / K) * (W - 2 * padX));
  const degree = clusters.map(() => 0);
  for (const [, s] of setOf) if (s.length > 1) for (const i of s) degree[i] += 1;
  const seq: number[] = [];
  { const c = Math.floor((K - 1) / 2); seq.push(c); for (let d = 1; d < K; d++) { if (c - d >= 0) seq.push(c - d); if (c + d < K) seq.push(c + d); } }
  const byDeg = clusters.map((_, i) => i).sort((a, b) => degree[b] - degree[a]);
  const hubSlot = new Array<number>(K);
  byDeg.forEach((hubIdx, rank) => { hubSlot[hubIdx] = seq[rank] ?? rank; });
  const rawHub = clusters.map((_, i) => ({ x: slotX(hubSlot[i]), y: cy }));

  const maxW = Math.max(1, ...Object.values(nodes).map((n) => n.weight ?? 0));
  const nodeR = (t: string) => { const w = nodes[t.toUpperCase()]?.weight ?? 0; return 22 + 9 * (w / maxW); };
  const meta = (t: string) => { const n = nodes[t.toUpperCase()]; return { status: n?.status ?? null, intact: n?.intact ?? 0, total: n?.total ?? 0 }; };

  const groups = new Map<string, string[]>();
  for (const [t, s] of setOf) { const k = s.join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }

  const raw = new Map<string, { x: number; y: number; r: number; status: PillarStatus | null; intact: number; total: number; bridge: boolean }>();
  for (const [key, tickers] of groups) {
    const s = key.split(',').map(Number);
    tickers.sort();
    if (s.length === 1) {
      // fan the hub's own positions upward
      const h = rawHub[s[0]];
      const m = tickers.length;
      const span = Math.min(2.6, 0.8 + m * 0.6);
      const MR = 116;
      const lean = K > 1 ? Math.sign(h.x - W / 2) : 0;
      const base = -Math.PI / 2 + lean * 0.5; // fan a hub's own positions outward, away from its bridges
      tickers.forEach((t, i) => {
        const frac = m === 1 ? 0 : i / (m - 1) - 0.5;
        const ang = base + frac * span;
        raw.set(t, { x: h.x + MR * Math.cos(ang), y: h.y + MR * Math.sin(ang), r: nodeR(t), ...meta(t), bridge: false });
      });
    } else {
      // bridge: midway between the hubs it shares. Stack multiple bridges vertically
      // (perpendicular to the horizontal hub axis) so a spoke to one bridge never passes
      // through another, which would read as a false line between them.
      const ax = s.reduce((a, i) => a + rawHub[i].x, 0) / s.length;
      const ay = cy - 48;
      const m = tickers.length;
      tickers.forEach((t, i) => {
        raw.set(t, { x: ax, y: ay + (i - (m - 1) / 2) * 70, r: nodeR(t), ...meta(t), bridge: true });
      });
    }
  }

  // relax: keep node circles from overlapping, AND push any node off a spoke it is not
  // part of. A foreign hub->node spoke crossing an unrelated circle reads as a false line
  // between two positions; this clears it.
  const placed = [...raw.entries()];
  const segClear = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
    const len2 = vx * vx + vy * vy || 1;
    const tt = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const cxp = ax + tt * vx, cyp = ay + tt * vy;
    return { d: Math.hypot(px - cxp, py - cyp), nx: px - cxp, ny: py - cyp };
  };
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i][1], b = placed[j][1];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d === 0) { dx = 1; dy = 0; d = 1; }
        const min = a.r + b.r + 12;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
          moved = true;
        }
      }
    }
    for (const [t, node] of placed) {
      for (const [t2, n2] of placed) {
        if (t2 === t) continue;
        for (const hi of setOf.get(t2) ?? []) {
          const h = rawHub[hi];
          const clear = node.r + 9;
          const { d, nx, ny } = segClear(node.x, node.y, h.x, h.y, n2.x, n2.y);
          if (d < clear) {
            let ux = nx, uy = ny, dd = d;
            if (dd === 0) { ux = 0; uy = -1; dd = 1; }
            const push = clear - dd;
            node.x += (ux / dd) * push; node.y += (uy / dd) * push;
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }

  // fit hubs (+ label room) and nodes into the web band, filling the width
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number, r: number) => { minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r); };
  rawHub.forEach((h) => { acc(h.x, h.y, 14); acc(h.x, h.y + 42, 8); });
  raw.forEach((n) => acc(n.x, n.y, n.r + 4));
  const sidePad = 36, padTop = 18, padBot = 16;
  const sc = Math.min((W - 2 * sidePad) / Math.max(1, maxX - minX), (webH - padTop - padBot) / Math.max(1, maxY - minY), 1.15);
  const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = padTop - minY * sc + ((webH - padTop - padBot) - (maxY - minY) * sc) / 2;
  const fit = (x: number, y: number) => ({ x: x * sc + ox, y: y * sc + oy });

  const hubs: WebHub[] = rawHub.map((h, i) => { const f = fit(h.x, h.y); return { x: f.x, y: f.y, lines: wrapDriver(clusters[i].driver) }; });
  const nodePos = new Map<string, WebNode>();
  for (const [t, n] of raw) { const f = fit(n.x, n.y); nodePos.set(t, { x: f.x, y: f.y, r: n.r * sc, status: n.status, intact: n.intact, total: n.total, bridge: n.bridge }); }

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
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] shrink-0" style={MONO}>
          How your theses connect
        </span>
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap flex-1 min-w-0">
          {clusters.map((c, i) => (
            <span key={`${c.driver}-${i}`} className="inline-flex items-center gap-2 text-[14px] text-[#B4B4B4]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-gold)', boxShadow: '0 0 8px rgba(230,185,77,0.7)' }} />
              <span className="truncate max-w-[260px]">{c.driver}</span>
              <span className="font-mono text-[14px] font-semibold text-[#FAFAFA]" style={MONO}>{clusterTickers[i].length}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 font-mono text-[12.5px] tracking-[0.06em] rounded px-3.5 py-1.5 border transition-colors hover:brightness-110"
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
  const H = 330;
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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 380 }} role="img" aria-label="Shared-driver web of your theses">
        {/* spokes: faint straight lines, driver hub to each position it ties together */}
        {edges.map((e, i) => (
          <line key={`e-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={EDGE} strokeWidth={e.bridge ? 1.5 : 1.25} opacity={e.bridge ? 0.9 : 0.6} />
        ))}

        {/* hubs: gold dot + glow, labelled pill below */}
        {hubs.map((h, i) => {
          const wMax = Math.max(...h.lines.map((l) => l.length));
          const pw = wMax * 6.6 + 16;
          return (
            <g key={`h-${i}`}>
              <circle cx={h.x} cy={h.y} r={8} fill="#E6B94D" style={{ filter: 'drop-shadow(0 0 10px rgba(230,185,77,0.9))' }} />
              <rect x={h.x - pw / 2} y={h.y + 13} width={pw} height={h.lines.length * 14 + 8} rx={3} fill="#0A0A0A" stroke="rgba(230,185,77,0.20)" strokeWidth={1} />
              {h.lines.map((ln, k) => (
                <text key={k} x={h.x} y={h.y + 13 + 14 + k * 14} textAnchor="middle" fontSize={12} fill="#FFD67A" fontFamily="var(--font-mono)" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                  <circle cx={n.x} cy={n.y} r={lr} fill="#FFFFFF" />
                  <image
                    href={`https://img.logo.dev/ticker/${encodeURIComponent(t)}?token=${LOGO_TOKEN}&size=${Math.min(800, Math.round(lr * 4))}&format=png&retina=true&fallback=404`}
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
          <span key={l} className="inline-flex items-center gap-2 font-mono text-[12px] text-[#8A8A8A]" style={MONO}>
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <p className="font-mono text-[12px] text-[#5A5A5A] mt-2 px-2" style={MONO}>
        Each gold hub is a shared driver; a line ties it to every position that depends on it. A position on two hubs (gold ring) rides both. Size = weight.
      </p>
    </div>
  );
}
