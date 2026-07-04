// Driver strip + openable Constellation web for /dashboard/theses (Coexist A).
// Collapsed: a one-row strip of shared-driver chips (always-visible insight).
// Expanded: the Constellation — a hub-centric galaxy. Each shared driver is a
// LARGE labelled gold disc (the focal point of the map); its positions orbit
// above it in a fan; a position shared by 2+ drivers sits between their discs
// with an edge into each. Edges take the position's status colour so health is
// visible in the wiring itself. Circles + straight lines only. Deterministic,
// dependency-free.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_META, type PillarStatus } from '@/lib/thesis-palette';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
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
  // Hard cap at 3 bounded lines so a long driver name can never blow out the disc.
  if (lines.length > 3) {
    const last = `${lines[2]} ${lines.slice(3).join(' ')}`;
    lines.length = 2;
    lines.push(last.length > maxLen ? `${last.slice(0, maxLen - 1).trimEnd()}…` : last);
  }
  return lines;
}

interface WebHub { x: number; y: number; r: number; lines: string[]; count: number }
interface WebNode { x: number; y: number; r: number; status: PillarStatus | null; intact: number; total: number; bridge: boolean }
interface WebEdge { x1: number; y1: number; x2: number; y2: number; color: string; bridge: boolean }

// Hub-centric layout: drivers are the anchors. Each driver disc is sized to hold
// its own wrapped name; solo positions fan on an orbit above their disc; shared
// positions sit on the line between the discs they connect. Discs that share
// positions are ordered adjacent so bridge edges stay short.
function layoutWeb(
  clusters: Cluster[],
  clusterTickers: string[][],
  nodes: Record<string, NodeInfo>,
  W: number,
  H: number,
) {
  const reserveBottom = 54;
  const webH = H - reserveBottom;
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

  const maxWt = Math.max(1, ...Object.values(nodes).map((n) => n.weight ?? 0));
  const satR = (t: string) => { const w = nodes[t.toUpperCase()]?.weight ?? 0; return 15 + 6 * (w / maxWt); };
  const meta = (t: string) => { const n = nodes[t.toUpperCase()]; return { status: n?.status ?? null, intact: n?.intact ?? 0, total: n?.total ?? 0 }; };

  const solos: string[][] = clusters.map(() => []);
  const bridges: string[] = [];
  for (const [t, s] of setOf) (s.length > 1 ? bridges : solos[s[0]]).push(t);
  bridges.sort();
  solos.forEach((a) => a.sort());

  // Disc radius: big enough for the wrapped name + position count, capped.
  const hubLines = clusters.map((c) => wrapDriver(c.driver, 14));
  const hubR = hubLines.map((lines) => {
    const wMax = Math.max(...lines.map((l) => l.length));
    return Math.min(62, Math.max(44, Math.hypot((wMax * 6.9) / 2, (lines.length * 13 + 16) / 2) + 11));
  });

  // Orbit radius: satellites must clear the disc AND each other along the fan.
  const orbit = clusters.map((_, i) => {
    const n = solos[i].length;
    const maxSat = n ? Math.max(...solos[i].map(satR)) : 15;
    let R = hubR[i] + maxSat + 24;
    if (n > 1) {
      const step = (Math.PI * 0.94) / (n - 1);
      R = Math.max(R, (2 * maxSat + 10) / (2 * Math.sin(step / 2)));
    }
    return R;
  });

  // Order discs so pairs sharing bridge positions sit adjacent (short bridge edges).
  const sharedCount = (a: number, b: number) =>
    bridges.filter((t) => { const s = setOf.get(t)!; return s.includes(a) && s.includes(b); }).length;
  const remaining = new Set(clusters.map((_, i) => i));
  const order: number[] = [];
  while (remaining.size) {
    const last = order[order.length - 1];
    const pick = [...remaining].sort(
      (a, b) =>
        (last === undefined ? 0 : sharedCount(last, b) - sharedCount(last, a)) ||
        clusterTickers[b].length - clusterTickers[a].length || a - b,
    )[0];
    order.push(pick);
    remaining.delete(pick);
  }

  // Each disc owns a territory as wide as its orbit; lay territories left to right.
  const gap = 46;
  const hubX: number[] = new Array(K).fill(0);
  let cursor = 0;
  for (const di of order) {
    const half = Math.max(orbit[di], hubR[di]) + 6;
    cursor += half;
    hubX[di] = cursor;
    cursor += half + gap;
  }

  type RawNode = { x: number; y: number; r: number; status: PillarStatus | null; intact: number; total: number; bridge: boolean };
  const raw = new Map<string, RawNode>();
  clusters.forEach((_, di) => {
    const n = solos[di].length;
    solos[di].forEach((t, j) => {
      const a = n === 1 ? Math.PI / 2 : Math.PI * (0.97 - 0.94 * (j / (n - 1)));
      raw.set(t, { x: hubX[di] + orbit[di] * Math.cos(a), y: -orbit[di] * Math.sin(a), r: satR(t), ...meta(t), bridge: false });
    });
  });

  // Shared positions: below the disc line, centred between the discs they ride.
  const bridgeGroups = new Map<string, string[]>();
  for (const t of bridges) { const k = setOf.get(t)!.join(','); if (!bridgeGroups.has(k)) bridgeGroups.set(k, []); bridgeGroups.get(k)!.push(t); }
  for (const [k, ts] of bridgeGroups) {
    const dis = k.split(',').map(Number);
    const bx = dis.reduce((s, d) => s + hubX[d], 0) / dis.length;
    const by = Math.max(...dis.map((d) => hubR[d])) + 24;
    ts.forEach((t, j) => {
      raw.set(t, { x: bx + (j - (ts.length - 1) / 2) * 54, y: by + satR(t), r: satR(t), ...meta(t), bridge: true });
    });
  }

  // Fit everything into the band, filling the width.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x: number, y: number, r: number) => { minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r); minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r); };
  clusters.forEach((_, di) => acc(hubX[di], 0, hubR[di] + 8));
  raw.forEach((n) => acc(n.x, n.y, n.r + 6));
  const sidePad = 30, padTop = 14, padBot = 12;
  const sc = Math.min((W - 2 * sidePad) / Math.max(1, maxX - minX), (webH - padTop - padBot) / Math.max(1, maxY - minY), 1.1);
  const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
  const oy = padTop - minY * sc + ((webH - padTop - padBot) - (maxY - minY) * sc) / 2;
  const fit = (x: number, y: number) => ({ x: x * sc + ox, y: y * sc + oy });

  const hubs: WebHub[] = clusters.map((c, di) => {
    const f = fit(hubX[di], 0);
    return { x: f.x, y: f.y, r: hubR[di] * sc, lines: hubLines[di], count: clusterTickers[di].length };
  });
  const nodePos = new Map<string, WebNode>();
  for (const [t, n] of raw) { const f = fit(n.x, n.y); nodePos.set(t, { x: f.x, y: f.y, r: n.r * sc, status: n.status, intact: n.intact, total: n.total, bridge: n.bridge }); }

  const edges: WebEdge[] = [];
  for (const [t, s] of setOf) {
    const n = nodePos.get(t);
    if (!n) continue;
    for (const hi of s) edges.push({ x1: hubs[hi].x, y1: hubs[hi].y, x2: n.x, y2: n.y, color: nodeColor(n.status), bridge: s.length > 1 });
  }

  const standalones = [...new Set(Object.keys(nodes).map((t) => t.toUpperCase()))].filter((t) => !setOf.has(t)).sort();
  return { hubs, nodePos, edges, standalones, dividerY: webH + 4, rowY: webH + reserveBottom / 2 + 3, sc };
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
  const H = 400;
  const [failedLogos, setFailedLogos] = useState<Set<string>>(() => new Set());
  const layoutKey = JSON.stringify({ c: clusterTickers, t: Object.keys(nodes).sort() });
  const { hubs, nodePos, edges, standalones, dividerY, rowY, sc } = useMemo(
    () => layoutWeb(clusters, clusterTickers, nodes, W, H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );

  const standaloneGap = standalones.length > 0 ? Math.min(104, (W - 130) / Math.max(1, standalones.length)) : 0;
  const standaloneStart = (W - standaloneGap * (standalones.length - 1)) / 2;
  const hubFs = Math.max(9.5, Math.min(12.5, 11.5 * sc));
  const hubLh = hubFs + 2.5;

  return (
    <div className="border-t border-white/[0.05] px-3 py-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 440 }} role="img" aria-label="Shared-driver web of your theses">
        {/* wiring first: each edge carries its position's status colour */}
        {edges.map((e, i) => (
          <line key={`e-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeWidth={e.bridge ? 1.6 : 1.3} opacity={e.bridge ? 0.7 : 0.42} />
        ))}

        {/* driver discs: the focal points, name set inside the disc */}
        {hubs.map((h, i) => {
          const blockH = h.lines.length * hubLh + 14;
          const startY = h.y - blockH / 2;
          return (
            <g key={`h-${i}`}>
              <circle cx={h.x} cy={h.y} r={h.r + 7} fill="none" stroke="rgba(230,185,77,0.14)" strokeWidth={1} />
              <circle cx={h.x} cy={h.y} r={h.r} fill="#17110A" stroke="rgba(230,185,77,0.55)" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 16px rgba(230,185,77,0.28))' }} />
              {h.lines.map((ln, k) => (
                <text
                  key={k}
                  x={h.x}
                  y={startY + hubLh * k + hubFs}
                  textAnchor="middle"
                  fontSize={hubFs}
                  fill="#FFD67A"
                  fontFamily="var(--font-mono)"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  {ln}
                </text>
              ))}
              <text x={h.x} y={startY + h.lines.length * hubLh + 11} textAnchor="middle" fontSize={9.5} fill="#8A8A8A" fontFamily="var(--font-mono)" style={{ letterSpacing: '0.08em' }}>
                {h.count} position{h.count === 1 ? '' : 's'}
              </text>
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
                  <text x={n.x} y={n.total > 0 && n.r >= 17 ? n.y - 1 : n.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FAFAFA" fontFamily="var(--font-mono)">{t}</text>
                  {n.total > 0 && n.r >= 17 && (
                    <text x={n.x} y={n.y + 11} textAnchor="middle" fontSize={9} fill={glow ? col : '#8A8A8A'} fontFamily="var(--font-mono)">{n.intact}/{n.total}</text>
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
        Each gold disc is a shared driver; its positions orbit it. A position between two discs (gold ring) rides both. Line colour = thesis status. Size = weight.
      </p>
    </div>
  );
}
