// ═══════════════════════════════════════════
// Canvas share card generator for Helm Wrapped
// Generates 1080x1080 PNG share cards
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

// ── Colors ──
const GOLD  = '#E6B94D';
const GREEN = '#4ADE80';
const RED   = '#F87171';
const WHITE = '#FAFAFA';
const MUTED = '#8A8A8A';
const BG    = '#0A0A0A';
const SURFACE = '#131313';

// ── Helpers ──
function signedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtDollars(n: number): string {
  const abs = Math.abs(n);
  const str = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${str}` : str;
}

// ── Drawing primitives ──
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  { color = WHITE, size = 14, weight = '600', align = 'center' as CanvasTextAlign, maxWidth }: {
    color?: string; size?: number; weight?: string; align?: CanvasTextAlign; maxWidth?: number;
  } = {}
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (maxWidth) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  drawText(ctx, text, x, y, { color: GOLD, size: 16, weight: '700' });
}

function drawGlow(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, opacity: number) {
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 450);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = opacity;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function drawBranding(ctx: CanvasRenderingContext2D, W: number, H: number, year: string) {
  // Top: HELM WRAPPED · YEAR
  drawText(ctx, `HELM WRAPPED  ·  ${year}`, W / 2, 60, { color: GOLD, size: 16, weight: '700' });

  // Bottom: gold dot + URL
  ctx.beginPath();
  ctx.arc(W / 2, H - 70, 5, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  drawText(ctx, 'helmterminal.dev/wrapped', W / 2, H - 38, { color: MUTED, size: 16, weight: '500' });
}

// ══════════════════════════════════════════
// Slide renderers — BIG, bold, shareable
// ══════════════════════════════════════════

function drawReturn(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  const pct = data.returnPct ?? 0;
  const positive = pct >= 0;

  drawText(ctx, 'YOUR PORTFOLIO RETURNED', W / 2, 320, { color: MUTED, size: 20, weight: '600' });

  // Giant return — the hero
  drawText(ctx, signedPct(pct), W / 2, 490, {
    color: positive ? GREEN : RED,
    size: 180,
    weight: '800',
  });

  // S&P comparison
  if (data.spyPct != null) {
    drawText(ctx, `vs S&P 500 ${signedPct(data.spyPct)}`, W / 2, 620, { color: MUTED, size: 22, weight: '500' });
  }

  // Beat badge
  if (data.beat) {
    // Pill background
    const badgeText = 'BEAT THE MARKET';
    ctx.font = 'bold 20px system-ui';
    const tw = ctx.measureText(badgeText).width;
    const bx = W / 2 - tw / 2 - 20;
    const by = 660;
    ctx.fillStyle = 'rgba(230, 185, 77, 0.15)';
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 40, 40, 20);
    ctx.fill();
    drawText(ctx, badgeText, W / 2, 680, { color: GOLD, size: 20, weight: '800' });
  }
}

function drawBestWorst(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  // MVP
  drawText(ctx, 'YOUR MVP', W / 2, 240, { color: GOLD, size: 18, weight: '700' });
  drawText(ctx, data.bestTicker ?? '---', W / 2, 320, { color: GOLD, size: 72, weight: '800' });
  drawText(ctx, data.bestReturnPct != null ? signedPct(data.bestReturnPct) : '---', W / 2, 400, {
    color: GREEN, size: 48, weight: '800',
  });

  // Separator
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(W / 2 - 40, 470, 80, 2);
  ctx.globalAlpha = 1;

  // Villain
  drawText(ctx, 'YOUR VILLAIN', W / 2, 540, { color: RED, size: 18, weight: '700' });
  drawText(ctx, data.worstTicker ?? '---', W / 2, 620, { color: RED, size: 72, weight: '800' });
  drawText(ctx, data.worstReturnPct != null ? signedPct(data.worstReturnPct) : '---', W / 2, 700, {
    color: RED, size: 48, weight: '800',
  });
}

function drawPersonality(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  drawText(ctx, 'YOUR INVESTOR TYPE', W / 2, 340, { color: GOLD, size: 18, weight: '700' });

  // Big personality name
  const name = data.personality ?? 'The Investor';
  drawText(ctx, name, W / 2, 480, { color: WHITE, size: 72, weight: '800' });

  // Gold underline
  ctx.fillStyle = GOLD;
  const metrics = ctx.measureText(name);
  ctx.font = 'bold 72px system-ui';
  const textW = ctx.measureText(name).width;
  ctx.fillRect(W / 2 - Math.min(textW, 400) / 2, 530, Math.min(textW, 400), 4);

  // Personality description
  const descriptions: Record<string, string> = {
    'Concentrator': 'High conviction. Few positions. Maximum exposure.',
    'Active Trader': 'Always moving. The market is your canvas.',
    'Income Investor': 'Cash flow is king. Dividends compound.',
    'Diversifier': 'Broad exposure. Risk-managed. Disciplined.',
    'Growth Hunter': 'Chasing alpha. Tech-heavy. Future-focused.',
    'Tax Optimizer': 'Every dollar counts. Loss harvest. Offset gains.',
    'Steady Hand': 'Buy and hold. Let time do the work.',
    'Momentum Rider': 'Ride the wave. Trend is your friend.',
    'Balanced Navigator': 'Measured approach. No extremes.',
  };
  const desc = descriptions[name] ?? 'A unique approach to the market.';
  drawText(ctx, desc, W / 2, 600, { color: MUTED, size: 20, weight: '500', maxWidth: 800 });
}

function drawHabits(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  drawText(ctx, 'YOUR YEAR IN NUMBERS', W / 2, 240, { color: GOLD, size: 18, weight: '700' });

  // 2x2 grid — big numbers
  const cells = [
    { value: String(data.tradeCount ?? 0), label: 'TRADES', x: 330, y: 420 },
    { value: fmtDollars(data.totalDividends ?? 0), label: 'DIVIDENDS', x: 750, y: 420 },
    { value: String(data.positionCount ?? 0), label: 'POSITIONS', x: 330, y: 640 },
    { value: data.personality ?? '---', label: 'TYPE', x: 750, y: 640 },
  ];

  for (const cell of cells) {
    // Card background
    ctx.fillStyle = SURFACE;
    ctx.beginPath();
    ctx.roundRect(cell.x - 160, cell.y - 60, 320, 140, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Value
    const isType = cell.label === 'TYPE';
    drawText(ctx, cell.value, cell.x, cell.y, {
      color: WHITE,
      size: isType ? 28 : 56,
      weight: '800',
    });

    // Label
    drawText(ctx, cell.label, cell.x, cell.y + 50, { color: GOLD, size: 14, weight: '700' });
  }
}

function drawSectors(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  drawText(ctx, 'YOUR CONVICTION', W / 2, 340, { color: GOLD, size: 18, weight: '700' });

  // Big percentage
  const pctText = data.topSectorPct != null ? `${data.topSectorPct.toFixed(0)}%` : '---';
  drawText(ctx, pctText, W / 2, 490, { color: WHITE, size: 120, weight: '800' });

  // Sector name
  drawText(ctx, data.topSector ?? 'Diversified', W / 2, 580, { color: GOLD, size: 32, weight: '600' });
}

function drawSummary(ctx: CanvasRenderingContext2D, W: number, H: number, data: ShareCardData) {
  drawText(ctx, `MY ${data.year} WRAPPED`, W / 2, 180, { color: GOLD, size: 20, weight: '800' });

  // Return — hero
  const pct = data.returnPct ?? 0;
  drawText(ctx, signedPct(pct), W / 2, 340, {
    color: pct >= 0 ? GREEN : RED,
    size: 100,
    weight: '800',
  });

  // Stats stack
  drawText(ctx, `${data.bestTicker ?? '---'} was my MVP`, W / 2, 460, { color: WHITE, size: 26, weight: '600' });
  drawText(ctx, `${data.tradeCount ?? 0} trades this year`, W / 2, 520, { color: MUTED, size: 24, weight: '500' });

  if (data.personality) {
    // Personality pill
    ctx.font = '700 22px system-ui';
    const tw = ctx.measureText(data.personality).width;
    ctx.fillStyle = 'rgba(230, 185, 77, 0.12)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2 - 20, 565, tw + 40, 44, 22);
    ctx.fill();
    drawText(ctx, data.personality, W / 2, 587, { color: GOLD, size: 22, weight: '700' });
  }

  if (data.beat) {
    drawText(ctx, 'BEAT THE S&P 500', W / 2, 660, { color: GREEN, size: 20, weight: '700' });
  }
}

// ══════════════════════════════════════════
// Main generator
// ══════════════════════════════════════════

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Glow
  const glowColor = data.slideType === 'return'
    ? ((data.returnPct ?? 0) >= 0 ? 'rgba(74,222,128,1)' : 'rgba(248,113,113,1)')
    : 'rgba(230,185,77,1)';
  drawGlow(ctx, W, H, glowColor, 0.06);

  // Branding
  drawBranding(ctx, W, H, data.year);

  // Slide content
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
