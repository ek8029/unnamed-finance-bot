// ═══════════════════════════════════════════
// V4 Share Card — 1080x1350 canvas renderer
// Matches share-card-drafts.html V4 design
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Helm mark — simplified SVG as canvas drawing
function drawMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 56;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  // Gold arc
  ctx.beginPath();
  ctx.arc(28 * s, 28 * s, 22 * s, Math.PI * 1.17, Math.PI * -0.17);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.8 * s;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(28 * s, 7 * s); ctx.lineTo(28 * s, 49 * s);
  ctx.moveTo(7 * s, 28 * s); ctx.lineTo(49 * s, 28 * s);
  ctx.strokeStyle = '#E8ECF1';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  // Dots
  ctx.beginPath(); ctx.arc(28 * s, 7 * s, 3 * s, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  ctx.beginPath(); ctx.arc(28 * s, 28 * s, 4.2 * s, 0, Math.PI * 2); ctx.fillStyle = '#E8ECF1'; ctx.fill();
  ctx.beginPath(); ctx.arc(28 * s, 28 * s, 2 * s, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  ctx.restore();
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

export async function generateShareCard(d: ShareCardInput): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const P = 72; // padding

  // ── Background ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Gold border
  ctx.strokeStyle = 'rgba(230,185,77,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 16);
  ctx.stroke();

  // Subtle gold glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.25, 0, W / 2, H * 0.25, 400);
  glow.addColorStop(0, 'rgba(230,185,77,0.04)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Top bar ──
  drawMark(ctx, P + 16, P + 16, 32);
  txt(ctx, 'HELM', P + 40, P + 4, GOLD, 15, '700', 'left', 'system-ui');
  txt(ctx, 'Wrapped', P + 100, P + 2, GOLD, 15, '400', 'left', 'Georgia, serif');
  txt(ctx, d.year, W - P, P + 4, '#8A8A8A', 14, '500', 'right', 'system-ui');

  // ── Hero return ──
  const heroY = 180;
  const pos = d.returnPct >= 0;
  const pctStr = fmtPct(d.returnPct);

  // Glow behind number
  if (pos) {
    const ng = ctx.createRadialGradient(W / 2, heroY + 80, 0, W / 2, heroY + 80, 300);
    ng.addColorStop(0, 'rgba(74,222,128,0.08)');
    ng.addColorStop(1, 'transparent');
    ctx.fillStyle = ng;
    ctx.fillRect(0, heroY - 40, W, 260);
  }

  txt(ctx, pctStr, W / 2, heroY, pos ? GREEN : RED, 200, '800', 'center');

  // "beat the market" + alpha
  const beatY = heroY + 210;
  txt(ctx, pos ? 'beat the market' : 'tough year', W / 2 - 80, beatY, GOLD, 28, '400', 'center', 'Georgia, serif');
  if (d.spyReturn != null) {
    const alpha = d.returnPct - d.spyReturn;
    txt(ctx, `ALPHA ${fmtPct(alpha)}`, W / 2 + 140, beatY + 4, GOLD, 24, '700', 'center', 'system-ui');
  }

  // ── Sector bar ──
  const sectorY = beatY + 60;
  const sectorColors = ['#E6B94D', '#7AA3C7', '#9FB89D', '#C8A165', '#8E7DC7', '#5A6070'];
  txt(ctx, 'SECTOR ALLOCATION', P, sectorY, '#666666', 13, '600', 'left', 'system-ui');

  const barY = sectorY + 28;
  const barW = W - P * 2;
  let barX = P;
  const totalPct = d.sectors.reduce((s, sec) => s + sec.pct, 0) || 100;
  for (let i = 0; i < d.sectors.length; i++) {
    const segW = Math.max((d.sectors[i].pct / totalPct) * barW, 4);
    roundRect(ctx, barX, barY, segW - 2, 14, 3, sectorColors[i % sectorColors.length]);
    barX += segW;
  }

  // Sector legend
  let legX = P;
  const legY = barY + 28;
  for (let i = 0; i < Math.min(d.sectors.length, 4); i++) {
    const label = `${d.sectors[i].pct.toFixed(0)}% ${d.sectors[i].sector}`;
    txt(ctx, label, legX, legY, sectorColors[i % sectorColors.length], 14, '600', 'left', 'system-ui');
    legX += ctx.measureText(label).width + 24;
  }

  // ── Gold divider ──
  const divY = legY + 40;
  const grad = ctx.createLinearGradient(P, divY, W - P, divY);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, 'rgba(230,185,77,0.25)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(P, divY, W - P * 2, 1);

  // ── 2x3 Stat grid ──
  const gridY = divY + 20;
  const cellW = (W - P * 2 - 32) / 3; // 3 cols, 16px gaps
  const cellH = 120;
  const gap = 16;

  const cells = [
    { label: 'MVP', value: d.bestTicker, sub: fmtPct(d.bestReturnPct), valColor: GOLD, subColor: GREEN, gold: true },
    { label: 'INVESTOR TYPE', value: d.personality, sub: '', valColor: GOLD, subColor: GOLD, gold: true, serif: true, smallVal: true },
    { label: 'TRADES', value: String(d.tradeCount), sub: '', valColor: WHITE, subColor: GOLD, gold: false },
    { label: 'DIVIDENDS', value: fmtK(d.totalDividends), sub: '', valColor: WHITE, subColor: '#555', gold: false },
    { label: 'PORTFOLIO', value: fmtK(d.portfolioValue), sub: '', valColor: WHITE, subColor: '#555', gold: false },
    { label: 'VILLAIN', value: d.worstTicker, sub: fmtPct(d.worstReturnPct), valColor: RED, subColor: RED, gold: false },
  ];

  cells.forEach((cell, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = P + col * (cellW + gap);
    const cy = gridY + row * (cellH + gap);

    const bg = cell.gold ? 'rgba(230,185,77,0.03)' : 'rgba(255,255,255,0.02)';
    const border = cell.gold ? 'rgba(230,185,77,0.12)' : 'rgba(255,255,255,0.05)';
    roundRect(ctx, cx, cy, cellW, cellH, 10, bg, border);

    txt(ctx, cell.label, cx + 20, cy + 16, '#666666', 12, '600', 'left', 'system-ui');

    const valSize = cell.smallVal ? 28 : 44;
    const valFont = cell.serif ? 'Georgia, serif' : 'system-ui, sans-serif';
    const valWeight = cell.serif ? '700' : '700';
    txt(ctx, cell.value, cx + 20, cy + 40, cell.valColor, valSize, valWeight, 'left', valFont);

    if (cell.sub) {
      txt(ctx, cell.sub, cx + 20, cy + 40 + valSize + 4, cell.subColor, 18, '600', 'left', 'system-ui');
    }
  });

  // ── Footer CTA ──
  const footY = gridY + 2 * (cellH + gap) + 24;
  roundRect(ctx, P, footY, W - P * 2, 52, 10, 'rgba(230,185,77,0.05)', 'rgba(230,185,77,0.12)');
  txt(ctx, 'HELMTERMINAL.DEV/WRAPPED', P + 24, footY + 16, '#AAAAAA', 16, '600', 'left', 'system-ui');
  txt(ctx, 'Get yours free →', W - P - 24, footY + 14, GOLD, 18, '700', 'right', 'Georgia, serif');

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
