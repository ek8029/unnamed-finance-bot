// ═══════════════════════════════════════════
// Canvas share card generator for Helm Wrapped
// 1080x1080 PNG — IN YOUR FACE, Spotify-scale
// ═══════════════════════════════════════════

export type SlideType = 'return' | 'bestWorst' | 'personality' | 'habits' | 'sectors' | 'summary';

export interface ShareCardData {
  slideType: SlideType;
  year: string;
  returnPct?: number;
  returnDollars?: number;
  spyPct?: number;
  beat?: boolean;
  bestTicker?: string;
  bestReturnPct?: number;
  worstTicker?: string;
  worstReturnPct?: number;
  personality?: string;
  tradeCount?: number;
  totalDividends?: number;
  positionCount?: number;
  topSector?: string;
  topSectorPct?: number;
}

const GOLD  = '#E6B94D';
const GREEN = '#4ADE80';
const RED   = '#F87171';
const WHITE = '#FAFAFA';
const MUTED = '#999999';
const BG    = '#0A0A0A';
const SURFACE = '#151515';

function signedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtK(n: number): string {
  const abs = Math.abs(n);
  const str = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1000 ? `$${(abs / 1000).toFixed(0)}K`
    : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${str}` : str;
}

// ── Drawing helpers ──

function txt(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  color: string, size: number, weight = '800',
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawHelmLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  // Gold arc
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.39, Math.PI * 1.17, Math.PI * -0.17);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.38);
  ctx.lineTo(cx, cy + size * 0.38);
  ctx.moveTo(cx - size * 0.38, cy);
  ctx.lineTo(cx + size * 0.38, cy);
  ctx.strokeStyle = '#E8ECF1';
  ctx.lineWidth = size * 0.05;
  ctx.stroke();
  // Top dot
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.38, size * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#E8ECF1';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, glowColor: string) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 500);
  glow.addColorStop(0, glowColor);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function drawBranding(ctx: CanvasRenderingContext2D, W: number, H: number, year: string) {
  // Logo top-center
  drawHelmLogo(ctx, W / 2, 55, 60);
  // "HELM WRAPPED · YEAR" below logo
  txt(ctx, `HELM WRAPPED  ·  ${year}`, W / 2, 110, GOLD, 18, '700');
  // CTA at bottom
  // Gold pill
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 180, H - 120, 360, 50, 25);
  ctx.fill();
  txt(ctx, 'Get yours free  →  helmterminal.dev/wrapped', W / 2, H - 95, '#000', 16, '700');
  // Fine print
  txt(ctx, 'HELM TERMINAL  ·  FREE FOR EVERYONE', W / 2, H - 50, MUTED, 13, '600');
}

// ══════════════════════════════════════════
// RETURN — the hero card
// ══════════════════════════════════════════

function drawReturn(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  const pct = d.returnPct ?? 0;
  const pos = pct >= 0;
  drawBg(ctx, W, H, pos ? 'rgba(74,222,128,1)' : 'rgba(248,113,113,1)');
  drawBranding(ctx, W, H, d.year);

  txt(ctx, 'MY PORTFOLIO RETURNED', W / 2, 220, MUTED, 22, '600');

  // MASSIVE number
  txt(ctx, signedPct(pct), W / 2, 420, pos ? GREEN : RED, 220, '800');

  // S&P comparison
  if (d.spyPct != null) {
    txt(ctx, `S&P 500: ${signedPct(d.spyPct)}`, W / 2, 580, MUTED, 24, '600');
  }
  if (d.beat) {
    ctx.fillStyle = 'rgba(74,222,128,0.15)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 150, 620, 300, 50, 25);
    ctx.fill();
    txt(ctx, 'BEAT THE MARKET', W / 2, 645, GREEN, 22, '800');
  }
}

// ══════════════════════════════════════════
// BEST & WORST
// ══════════════════════════════════════════

function drawBestWorst(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawBg(ctx, W, H, 'rgba(230,185,77,1)');
  drawBranding(ctx, W, H, d.year);

  // MVP
  txt(ctx, 'MY MVP', W / 2, 210, GOLD, 20, '700');
  txt(ctx, d.bestTicker ?? '---', W / 2, 300, GOLD, 90, '800');
  txt(ctx, d.bestReturnPct != null ? signedPct(d.bestReturnPct) : '---', W / 2, 390, GREEN, 56, '800');

  // Separator
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(W / 2 - 50, 450, 100, 2);
  ctx.globalAlpha = 1;

  // Villain
  txt(ctx, 'MY VILLAIN', W / 2, 510, RED, 20, '700');
  txt(ctx, d.worstTicker ?? '---', W / 2, 600, RED, 90, '800');
  txt(ctx, d.worstReturnPct != null ? signedPct(d.worstReturnPct) : '---', W / 2, 690, RED, 56, '800');
}

// ══════════════════════════════════════════
// PERSONALITY
// ══════════════════════════════════════════

function drawPersonality(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawBg(ctx, W, H, 'rgba(230,185,77,1)');
  drawBranding(ctx, W, H, d.year);

  txt(ctx, 'I INVEST LIKE', W / 2, 300, MUTED, 24, '600');

  // Big personality name
  const name = d.personality ?? 'The Investor';
  txt(ctx, name, W / 2, 450, GOLD, 80, '800');

  // Gold underline
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 60, 510, 120, 4);

  // Description
  const descs: Record<string, string> = {
    'The Concentrator': 'High conviction. Few positions. Maximum exposure.',
    'The Active Trader': 'Always moving. The market is my canvas.',
    'The Income Investor': 'Cash flow is king. Dividends compound.',
    'The Diversifier': 'Broad exposure. Risk-managed. Disciplined.',
    'The Growth Hunter': 'Chasing alpha. Tech-heavy. Future-focused.',
    'The Tax Optimizer': 'Every dollar counts. Harvest losses. Offset gains.',
    'The Steady Hand': 'Buy and hold. Let time do the work.',
    'The Momentum Rider': 'Ride the wave. Trend is friend.',
    'The Balanced Navigator': 'Measured approach. No extremes.',
  };
  txt(ctx, descs[name] ?? 'A unique approach to the market.', W / 2, 580, MUTED, 22, '500');
}

// ══════════════════════════════════════════
// HABITS
// ══════════════════════════════════════════

function drawHabits(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawBg(ctx, W, H, 'rgba(230,185,77,1)');
  drawBranding(ctx, W, H, d.year);

  txt(ctx, 'MY YEAR IN NUMBERS', W / 2, 210, GOLD, 22, '700');

  // 2x2 grid with card backgrounds
  const cells = [
    { value: String(d.tradeCount ?? 0), label: 'TRADES', x: 310, y: 400 },
    { value: fmtK(d.totalDividends ?? 0), label: 'DIVIDENDS', x: 770, y: 400 },
    { value: String(d.positionCount ?? 0), label: 'POSITIONS', x: 310, y: 600 },
    { value: d.personality ?? '---', label: 'TYPE', x: 770, y: 600 },
  ];

  for (const c of cells) {
    // Card bg
    ctx.fillStyle = SURFACE;
    ctx.beginPath();
    ctx.roundRect(c.x - 190, c.y - 70, 380, 160, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const isType = c.label === 'TYPE';
    txt(ctx, c.value, c.x, c.y, WHITE, isType ? 32 : 64, '800');
    txt(ctx, c.label, c.x, c.y + 55, GOLD, 16, '700');
  }
}

// ══════════════════════════════════════════
// SECTORS
// ══════════════════════════════════════════

function drawSectors(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawBg(ctx, W, H, 'rgba(230,185,77,1)');
  drawBranding(ctx, W, H, d.year);

  txt(ctx, 'MY CONVICTION', W / 2, 300, GOLD, 22, '700');

  const pctText = d.topSectorPct != null ? `${d.topSectorPct.toFixed(0)}%` : '---';
  txt(ctx, pctText, W / 2, 460, WHITE, 160, '800');

  txt(ctx, d.topSector ?? 'Diversified', W / 2, 580, GOLD, 36, '700');
}

// ══════════════════════════════════════════
// SUMMARY — the ultimate share card
// ══════════════════════════════════════════

function drawSummary(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  const pct = d.returnPct ?? 0;
  const pos = pct >= 0;
  drawBg(ctx, W, H, pos ? 'rgba(74,222,128,1)' : 'rgba(248,113,113,1)');
  drawBranding(ctx, W, H, d.year);

  txt(ctx, `MY ${d.year} WRAPPED`, W / 2, 200, GOLD, 22, '800');

  // Hero return
  txt(ctx, signedPct(pct), W / 2, 340, pos ? GREEN : RED, 130, '800');

  // Dollar P&L
  if (d.returnDollars != null) {
    txt(ctx, fmtK(d.returnDollars), W / 2, 430, pos ? GREEN : RED, 36, '700');
  }

  // Stats row — 3 cards
  const stats = [
    { label: 'MVP', value: d.bestTicker ?? '---', color: GOLD },
    { label: 'TRADES', value: String(d.tradeCount ?? 0), color: WHITE },
    { label: 'TYPE', value: d.personality ?? '---', color: GOLD },
  ];

  const cardW = 300;
  const startX = (W - cardW * 3 - 30) / 2;
  stats.forEach((s, i) => {
    const cx = startX + i * (cardW + 15) + cardW / 2;
    const cy = 570;
    ctx.fillStyle = SURFACE;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - 50, cardW, 120, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    txt(ctx, s.value, cx, cy, s.color, s.label === 'TYPE' ? 22 : 32, '800');
    txt(ctx, s.label, cx, cy + 40, MUTED, 14, '700');
  });

  // Beat badge
  if (d.beat) {
    ctx.fillStyle = 'rgba(74,222,128,0.12)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 130, 700, 260, 44, 22);
    ctx.fill();
    txt(ctx, 'BEAT THE S&P 500', W / 2, 722, GREEN, 18, '800');
  }
}

// ══════════════════════════════════════════
// Main
// ══════════════════════════════════════════

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  switch (data.slideType) {
    case 'return': drawReturn(ctx, W, H, data); break;
    case 'bestWorst': drawBestWorst(ctx, W, H, data); break;
    case 'personality': drawPersonality(ctx, W, H, data); break;
    case 'habits': drawHabits(ctx, W, H, data); break;
    case 'sectors': drawSectors(ctx, W, H, data); break;
    case 'summary': drawSummary(ctx, W, H, data); break;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
