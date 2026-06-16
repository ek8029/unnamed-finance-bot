// Driver strip + openable Constellation map for /dashboard/theses (Coexist A).
// Collapsed: a one-row strip of shared-driver chips (always-visible insight).
// Expanded: a force-directed map — positions repel, shared-driver links pull, and
// a collision pass guarantees nodes never overlap, so each driver's positions form
// a readable cluster, bridges land between the drivers they ride, standalones drift
// to the edge. Self-arranging, deterministic, dependency-free.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_META, type PillarStatus } from '@/lib/thesis-palette';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

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

function wrapDriver(s: string, maxLen = 16): string[] {
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

type Pt = { x: number; y: number };
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const hi: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}
// Soft enclosing blob behind a cluster's points (expanded hull, smoothed corners).
function blobPath(points: Pt[], pad: number): string {
  if (points.length === 0) return '';
  const cxv = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cyv = points.reduce((s, p) => s + p.y, 0) / points.length;
  let h = convexHull(points);
  if (h.length < 3) {
    let R = pad;
    for (const p of points) R = Math.max(R, Math.hypot(p.x - cxv, p.y - cyv) + pad);
    return `M ${cxv - R},${cyv} a ${R},${R} 0 1,0 ${2 * R},0 a ${R},${R} 0 1,0 ${-2 * R},0 Z`;
  }
  h = h.map((p) => { const dx = p.x - cxv, dy = p.y - cyv, d = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / d) * pad, y: p.y + (dy / d) * pad }; });
  let path = `M ${(h[h.length - 1].x + h[0].x) / 2},${(h[h.length - 1].y + h[0].y) / 2}`;
  for (let i = 0; i < h.length; i++) { const cur = h[i], nxt = h[(i + 1) % h.length]; path += ` Q ${cur.x},${cur.y} ${(cur.x + nxt.x) / 2},${(cur.y + nxt.y) / 2}`; }
  return path + ' Z';
}

interface SimNode { x: number; y: number; vx: number; vy: number; hub: boolean; col: number; r: number }
function layoutForce(
  clusters: Cluster[],
  clusterTickers: string[][],
  nodes: Record<string, NodeInfo>,
  W: number,
  H: number,
) {
  const cx = W / 2;
  const cy = H / 2;
  const GOLDEN = 2.39996;
  const sims: SimNode[] = [];
  const idx = new Map<string, number>();

  const tickerHubs = new Map<string, number[]>();
  clusterTickers.forEach((tks, hi) => { for (const t of tks) { if (!tickerHubs.has(t)) tickerHubs.set(t, []); tickerHubs.get(t)!.push(hi); } });
  const allTickers = [...new Set([...tickerHubs.keys(), ...Object.keys(nodes).map((t) => t.toUpperCase())])];

  // draw radius scales down as the graph gets denser
  const N = allTickers.length;
  const baseR = N > 40 ? 13 : N > 22 ? 16 : 19;
  const maxR = N > 40 ? 21 : 27;
  const drawR = (t: string) => { const w = nodes[t]?.weight; return w ? Math.max(baseR, Math.min(maxR, baseR + w * 0.5)) : baseR; };

  clusters.forEach((_, i) => {
    const a = -Math.PI / 2 + (i / clusters.length) * Math.PI * 2;
    idx.set(`hub:${i}`, sims.length);
    sims.push({ x: cx + 150 * Math.cos(a), y: cy + 150 * Math.sin(a), vx: 0, vy: 0, hub: true, col: 30, r: 6 });
  });
  allTickers.forEach((t, k) => {
    const hubs = tickerHubs.get(t) ?? [];
    const a = k * GOLDEN;
    const seed = hubs.length ? sims[idx.get(`hub:${hubs[0]}`)!] : { x: cx, y: cy };
    const dist = hubs.length ? 60 : 220;
    idx.set(`t:${t}`, sims.length);
    sims.push({ x: seed.x + dist * Math.cos(a), y: seed.y + dist * Math.sin(a), vx: 0, vy: 0, hub: false, col: drawR(t) + 34, r: drawR(t) });
  });

  const links: [number, number][] = [];
  for (const [t, hubs] of tickerHubs) for (const hi of hubs) links.push([idx.get(`hub:${hi}`)!, idx.get(`t:${t}`)!]);

  const REP = 8600, L = 168, KS = 0.04, GRAV = 0.018, DAMP = 0.85;
  for (let iter = 0; iter < 340; iter++) {
    for (const s of sims) { s.vx *= DAMP; s.vy *= DAMP; }
    for (let i = 0; i < sims.length; i++) {
      for (let j = i + 1; j < sims.length; j++) {
        const a = sims[i], b = sims[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = (i - j) || 1; }
        const d = Math.sqrt(d2);
        const f = REP / d2;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const [i, j] of links) {
      const a = sims[i], b = sims[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - L) * KS;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const s of sims) { s.vx += (cx - s.x) * GRAV * (s.hub ? 0.5 : 1); s.vy += (cy - s.y) * GRAV * (s.hub ? 0.5 : 1); }
    for (const s of sims) { s.x += s.vx; s.y += s.vy; }
  }

  // collision resolution: no two nodes (incl. their label halo) overlap
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < sims.length; i++) {
      for (let j = i + 1; j < sims.length; j++) {
        const a = sims[i], b = sims[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.col + b.col;
        let d = Math.hypot(dx, dy);
        if (d < min && d > 0) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        } else if (d === 0) {
          a.x -= min / 2; b.x += min / 2;
        }
      }
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of sims) { minX = Math.min(minX, s.x - s.col); minY = Math.min(minY, s.y - s.col); maxX = Math.max(maxX, s.x + s.col); maxY = Math.max(maxY, s.y + s.col); }
  const pad = 46;
  const sc = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY), 1);
  const ox = (W - (maxX - minX) * sc) / 2;
  const oy = (H - (maxY - minY) * sc) / 2;
  for (const s of sims) { s.x = ox + (s.x - minX) * sc; s.y = oy + (s.y - minY) * sc; }

  const hubPos = clusters.map((_, i) => { const s = sims[idx.get(`hub:${i}`)!]; return { x: s.x, y: s.y }; });
  const posByTicker = new Map<string, { x: number; y: number; r: number }>();
  for (const t of allTickers) { const s = sims[idx.get(`t:${t}`)!]; posByTicker.set(t, { x: s.x, y: s.y, r: s.r }); }
  const standalones = allTickers.filter((t) => !(tickerHubs.get(t)?.length));
  // faint enclosing blob per driver (hub + its members), reinforces grouping
  const hulls = clusters.map((_, hi) => {
    const pts: Pt[] = [hubPos[hi], ...allTickers.filter((t) => (tickerHubs.get(t) ?? []).includes(hi)).map((t) => posByTicker.get(t)!)];
    return blobPath(pts, 36);
  });
  return { hubPos, posByTicker, tickerHubs, standalones, hulls, labelSize: N > 40 ? 9 : 10.5 };
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
      <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] shrink-0" style={MONO}>
          How your theses connect
        </span>
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap flex-1 min-w-0">
          {clusters.map((c, i) => (
            <span key={`${c.driver}-${i}`} className="inline-flex items-center gap-2 text-[12.5px] text-[#9A9A9A]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-gold)', boxShadow: '0 0 8px rgba(230,185,77,0.7)' }} />
              <span className="truncate max-w-[240px]">{c.driver}</span>
              <span className="font-mono text-[12px] font-semibold text-[#FAFAFA]" style={MONO}>{clusterTickers[i].length}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 font-mono text-[11px] tracking-[0.06em] rounded px-3 py-1.5 border transition-colors hover:brightness-110"
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
  const H = 660;
  const layoutKey = JSON.stringify({ c: clusterTickers, t: Object.keys(nodes).sort() });
  const { hubPos, posByTicker, tickerHubs, standalones, hulls, labelSize } = useMemo(
    () => layoutForce(clusters, clusterTickers, nodes, W, H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );
  const isStandalone = new Set(standalones);

  return (
    <div className="border-t border-white/[0.05] px-3 py-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 720 }} role="img" aria-label="Shared-driver map of your theses">
        {/* cluster hulls (faint grouping blobs, drawn behind everything) */}
        {hulls.map((d, i) => (d ? <path key={`hull-${i}`} d={d} fill="rgba(230,185,77,0.05)" stroke="rgba(230,185,77,0.13)" strokeWidth={1} /> : null))}
        {/* links (straight, crisp) */}
        {[...tickerHubs.entries()].flatMap(([t, hubs]) => {
          const p = posByTicker.get(t);
          if (!p) return [];
          const bridge = hubs.length > 1;
          return hubs.map((hi) => (
            <line key={`e-${t}-${hi}`} x1={hubPos[hi].x} y1={hubPos[hi].y} x2={p.x} y2={p.y} stroke={bridge ? 'rgba(230,185,77,0.45)' : 'rgba(230,185,77,0.14)'} strokeWidth={bridge ? 1.4 : 1} />
          ));
        })}

        {/* hubs */}
        {clusters.map((c, hi) => {
          const lines = wrapDriver(c.driver);
          return (
            <g key={`h-${hi}`}>
              <circle cx={hubPos[hi].x} cy={hubPos[hi].y} r={6} fill="#E6B94D" style={{ filter: 'drop-shadow(0 0 7px rgba(230,185,77,0.55))' }} />
              {lines.map((ln, k) => (
                <text key={k} x={hubPos[hi].x} y={hubPos[hi].y - 13 - (lines.length - 1 - k) * 12} textAnchor="middle" fontSize={10.5} fill="#FFD67A" fontFamily="var(--font-mono)" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {ln}
                </text>
              ))}
            </g>
          );
        })}

        {/* nodes (crisp stroke, no glow haze) */}
        {[...posByTicker.entries()].map(([t, p]) => {
          const info = nodes[t];
          const col = nodeColor(info?.status ?? null);
          return (
            <g key={`n-${t}`} opacity={isStandalone.has(t) ? 0.62 : 1}>
              <circle cx={p.x} cy={p.y} r={p.r} fill="#0E0E0E" stroke={col} strokeWidth={1.75} />
              <text x={p.x} y={info && info.total > 0 ? p.y - 1 : p.y + 4} textAnchor="middle" fontSize={labelSize} fontWeight={600} fill="#FAFAFA" fontFamily="var(--font-mono)">{t}</text>
              {info && info.total > 0 && (
                <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize={8.5} fill="#7A7A7A" fontFamily="var(--font-mono)">{info.intact}/{info.total}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 px-2 mt-2 flex-wrap">
        {([['#4ADE80', 'Intact'], ['#E6B94D', 'Weakening'], ['#F87171', 'Broken'], ['#6A6A6A', 'Watching']] as const).map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#6A6A6A]" style={MONO}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <p className="font-mono text-[10.5px] text-[#4A4A4A] mt-1.5 px-2" style={MONO}>
        Positions cluster around the drivers they depend on; brighter links mark one riding more than one. Size = weight.
      </p>
    </div>
  );
}
