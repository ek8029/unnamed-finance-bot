// ═══════════════════════════════════════════
// V4 Share Card — 1080x1350 canvas renderer
// Matches on-screen card exactly
// ═══════════════════════════════════════════

export interface ShareCardInput {
  year: string;
  returnPct: number;
  returnDollars: number;
  spyReturn: number | null;
  beat: boolean;
  bestTicker: string;
  bestReturnPct: number;
  worstTicker: string;
  worstReturnPct: number;
  personality: string;
  tradeCount: number;
  totalDividends: number;
  portfolioValue: number;
  sectors: { sector: string; pct: number }[];
}

const GOLD = '#E6B94D';
const GREEN = '#4ADE80';
const RED = '#F87171';
const WHITE = '#FAFAFA';
const BG = '#0A0A0A';
const MUTED = '#666666';
const DIM = '#444444';

// Use 2x resolution for crisp output
const SCALE = 2;
const W = 1080 * SCALE;
const H = 1350 * SCALE;
const P = 80 * SCALE; // padding

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtDollar(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `$${Math.round(abs / 1000).toLocaleString()}K`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function s(px: number) { return px * SCALE; }

function txt(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, color: string, size: number,
  weight = '700', align: CanvasTextAlign = 'left',
  font = 'system-ui, -apple-system, sans-serif',
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s(1);
    ctx.stroke();
  }
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const sc = size / 56;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(28 * sc, 28 * sc, 22 * sc, Math.PI * 1.17, Math.PI * -0.17);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2 * sc; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28 * sc, 7 * sc); ctx.lineTo(28 * sc, 49 * sc);
  ctx.moveTo(7 * sc, 28 * sc); ctx.lineTo(49 * sc, 28 * sc);
  ctx.strokeStyle = '#E8ECF1'; ctx.lineWidth = 1.5 * sc; ctx.stroke();
  ctx.beginPath(); ctx.arc(28 * sc, 7 * sc, 3 * sc, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  ctx.beginPath(); ctx.arc(28 * sc, 28 * sc, 4 * sc, 0, Math.PI * 2); ctx.fillStyle = '#E8ECF1'; ctx.fill();
  ctx.beginPath(); ctx.arc(28 * sc, 28 * sc, 2 * sc, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  ctx.restore();
}

export async function generateShareCard(d: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const pos = d.returnPct >= 0;
  const sectorColors = ['#E6B94D', '#7AA3C7', '#9FB89D', '#C8A165', '#8E7DC7', '#5A6070'];

  // ── Background ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Gold border
  ctx.strokeStyle = 'rgba(230,185,77,0.25)';
  ctx.lineWidth = s(2);
  ctx.beginPath();
  ctx.roundRect(s(2), s(2), W - s(4), H - s(4), s(16));
  ctx.stroke();

  // Gold glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.22, 0, W / 2, H * 0.22, s(500));
  glow.addColorStop(0, 'rgba(230,185,77,0.05)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Top bar ──
  drawMark(ctx, P, P, s(40));
  txt(ctx, 'HELM', P + s(48), P + s(8), GOLD, s(18), '700');
  txt(ctx, 'Wrapped', P + s(120), P + s(6), GOLD, s(18), '400', 'left', 'Georgia, serif');
  txt(ctx, d.year, W - P, P + s(8), '#888888', s(16), '600', 'right');

  // ── Hero return ──
  const heroY = P + s(120);
  txt(ctx, fmtPct(d.returnPct), W / 2, heroY, pos ? GREEN : RED, s(180), '800', 'center');

  // "beat the market" + alpha
  const beatY = heroY + s(190);
  txt(ctx, pos ? 'beat the market' : 'tough year', W / 2 - s(100), beatY, GOLD, s(28), '400', 'center', 'Georgia, serif');
  if (d.spyReturn != null) {
    const alpha = d.returnPct - d.spyReturn;
    txt(ctx, `ALPHA ${fmtPct(alpha)}`, W / 2 + s(120), beatY + s(4), GOLD, s(24), '700', 'center');
  }

  // ── Sector bar ──
  const secY = beatY + s(70);
  txt(ctx, 'SECTOR ALLOCATION', P, secY, MUTED, s(14), '600');

  const barY = secY + s(30);
  const barW = W - P * 2;
  let bx = P;
  const total = d.sectors.reduce((sum, sec) => sum + sec.pct, 0) || 100;
  for (let i = 0; i < d.sectors.length; i++) {
    const segW = Math.max((d.sectors[i].pct / total) * barW, s(4));
    rect(ctx, bx, barY, segW - s(2), s(14), s(4), sectorColors[i % sectorColors.length]);
    bx += segW;
  }

  // Legend
  let lx = P;
  const ly = barY + s(28);
  for (let i = 0; i < Math.min(d.sectors.length, 4); i++) {
    const label = `${d.sectors[i].pct.toFixed(0)}% ${d.sectors[i].sector}`;
    ctx.font = `600 ${s(14)}px system-ui`;
    txt(ctx, label, lx, ly, sectorColors[i % sectorColors.length], s(14), '600');
    lx += ctx.measureText(label).width + s(28);
  }

  // ── Gold divider ──
  const divY = ly + s(40);
  const grad = ctx.createLinearGradient(P, divY, W - P, divY);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, 'rgba(230,185,77,0.3)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(P, divY, W - P * 2, s(1));

  // ── 2x3 Stat grid ──
  const gridY = divY + s(24);
  const gap = s(16);
  const cellW = (W - P * 2 - gap * 2) / 3;
  const cellH = s(110);

  const cells: { label: string; value: string; sub?: string; valColor: string; subColor?: string; gold?: boolean; serif?: boolean }[] = [
    { label: 'MVP', value: d.bestTicker, sub: fmtPct(d.bestReturnPct), valColor: GOLD, subColor: GREEN, gold: true },
    { label: 'INVESTOR TYPE', value: d.personality, valColor: GOLD, gold: true, serif: true },
    { label: 'TRADES', value: String(d.tradeCount), valColor: WHITE },
    { label: 'DIVIDENDS', value: fmtDollar(d.totalDividends), valColor: WHITE },
    { label: 'PORTFOLIO', value: fmtDollar(d.portfolioValue), valColor: WHITE },
    { label: 'VILLAIN', value: d.worstTicker, sub: fmtPct(d.worstReturnPct), valColor: RED, subColor: RED },
  ];

  cells.forEach((cell, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = P + col * (cellW + gap);
    const cy = gridY + row * (cellH + gap);

    const bg = cell.gold ? 'rgba(230,185,77,0.03)' : 'rgba(255,255,255,0.02)';
    const border = cell.gold ? 'rgba(230,185,77,0.12)' : 'rgba(255,255,255,0.05)';
    rect(ctx, cx, cy, cellW, cellH, s(10), bg, border);

    txt(ctx, cell.label, cx + s(18), cy + s(14), '#666666', s(11), '600');

    const valSize = cell.serif ? s(26) : s(40);
    const valFont = cell.serif ? 'Georgia, serif' : 'system-ui';
    txt(ctx, cell.value, cx + s(18), cy + s(36), cell.valColor, valSize, '700', 'left', valFont);

    if (cell.sub) {
      txt(ctx, cell.sub, cx + s(18), cy + s(36) + valSize + s(4), cell.subColor ?? MUTED, s(16), '600');
    }
  });

  // ── Footer CTA ──
  const footY = gridY + 2 * (cellH + gap) + s(24);
  rect(ctx, P, footY, W - P * 2, s(52), s(10), 'rgba(230,185,77,0.05)', 'rgba(230,185,77,0.12)');
  txt(ctx, 'HELMTERMINAL.DEV/WRAPPED', P + s(24), footY + s(16), '#AAAAAA', s(16), '600');
  txt(ctx, 'Get yours free \u2192', W - P - s(24), footY + s(14), GOLD, s(18), '700', 'right', 'Georgia, serif');

  // Output at original resolution (downscale from 2x)
  const output = document.createElement('canvas');
  output.width = 1080;
  output.height = 1350;
  const outCtx = output.getContext('2d')!;
  outCtx.drawImage(canvas, 0, 0, 1080, 1350);

  return new Promise((resolve) => {
    output.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
