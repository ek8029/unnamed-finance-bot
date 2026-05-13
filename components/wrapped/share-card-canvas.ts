// ═══════════════════════════════════════════
// Canvas share card generator for Helm Wrapped
// Generates 1080x1080 PNG cards per slide
// ═══════════════════════════════════════════

export type SlideType = 'return' | 'bestWorst' | 'personality' | 'habits' | 'sectors' | 'summary';

export interface ShareCardData {
  slideType: SlideType;
  year: string;
  // Return slide
  returnPct?: number;
  returnDollars?: number;
  spyPct?: number;
  beat?: boolean;
  // Best/worst
  bestTicker?: string;
  bestReturnPct?: number;
  worstTicker?: string;
  worstReturnPct?: number;
  // Personality
  personality?: string;
  // Habits
  tradeCount?: number;
  totalDividends?: number;
  positionCount?: number;
  // Sectors
  topSector?: string;
  topSectorPct?: number;
}

// ── Colors ──

const GOLD   = '#E6B94D';
const GREEN  = '#4ADE80';
const RED    = '#F87171';
const WHITE  = '#FAFAFA';
const MUTED  = '#8A8A8A';
const BG     = '#0A0A0A';

// ── Helpers ──

function signedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtDollars(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${formatted}` : formatted;
}

// ── Draw functions ──

function drawReturn(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  const pct = data.returnPct ?? 0;
  const positive = pct >= 0;

  // Label
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR PORTFOLIO RETURNED', W / 2, 340);

  // Giant return number
  ctx.fillStyle = positive ? GREEN : RED;
  ctx.font = 'bold 120px system-ui, -apple-system, sans-serif';
  ctx.fillText(signedPct(pct), W / 2, 460);

  // S&P comparison
  if (data.spyPct != null) {
    ctx.fillStyle = MUTED;
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(`vs S&P 500 ${signedPct(data.spyPct)}`, W / 2, 520);
  }

  // Beat badge
  if (data.beat) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('BEAT THE MARKET', W / 2, 570);
  }
}

function drawBestWorst(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  // MVP section
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR MVP', W / 2, 280);

  ctx.fillStyle = GOLD;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.bestTicker ?? '---', W / 2, 340);

  ctx.fillStyle = GREEN;
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.bestReturnPct != null ? signedPct(data.bestReturnPct) : '---', W / 2, 400);

  // Gold separator line
  ctx.beginPath();
  ctx.moveTo(W / 2 - 30, 480);
  ctx.lineTo(W / 2 + 30, 480);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Villain section
  ctx.fillStyle = RED;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR VILLAIN', W / 2, 560);

  ctx.fillStyle = RED;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.worstTicker ?? '---', W / 2, 620);

  ctx.fillStyle = RED;
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.worstReturnPct != null ? signedPct(data.worstReturnPct) : '---', W / 2, 680);
}

function drawPersonality(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR INVESTOR TYPE', W / 2, 380);

  ctx.fillStyle = WHITE;
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.personality ?? 'The Investor', W / 2, 480);

  // Gold underline
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 30, 510, 60, 3);
}

function drawHabits(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR YEAR IN NUMBERS', W / 2, 300);

  // 2x2 grid
  const cells = [
    { value: String(data.tradeCount ?? 0), label: 'TRADES', x: 340, y: 430 },
    { value: fmtDollars(data.totalDividends ?? 0), label: 'DIVIDENDS', x: 740, y: 430 },
    { value: String(data.positionCount ?? 0), label: 'POSITIONS', x: 340, y: 600 },
    { value: data.personality ?? '---', label: 'TYPE', x: 740, y: 600 },
  ];

  for (const cell of cells) {
    // Value
    ctx.fillStyle = WHITE;
    ctx.font = cell.label === 'TYPE' ? 'bold 24px system-ui, -apple-system, sans-serif' : 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.fillText(cell.value, cell.x, cell.y);

    // Label
    ctx.fillStyle = GOLD;
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(cell.label, cell.x, cell.y + 30);
  }
}

function drawSectors(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('YOUR CONVICTION', W / 2, 380);

  // Big percentage
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 80px system-ui, -apple-system, sans-serif';
  const pctText = data.topSectorPct != null ? `${data.topSectorPct.toFixed(0)}%` : '---';
  ctx.fillText(pctText, W / 2, 480);

  // Sector name
  ctx.fillStyle = GOLD;
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.topSector ?? 'Diversified', W / 2, 540);
}

function drawSummary(ctx: CanvasRenderingContext2D, W: number, _H: number, data: ShareCardData) {
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`MY ${data.year} WRAPPED`, W / 2, 200);

  // Return
  const pct = data.returnPct ?? 0;
  ctx.fillStyle = pct >= 0 ? GREEN : RED;
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(signedPct(pct), W / 2, 340);

  // MVP line
  ctx.fillStyle = WHITE;
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${data.bestTicker ?? '---'} was my MVP`, W / 2, 420);

  // Trades line
  ctx.fillStyle = MUTED;
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${data.tradeCount ?? 0} trades`, W / 2, 470);

  // Personality
  ctx.fillStyle = GOLD;
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.personality ?? '', W / 2, 520);
}

// ── Main generator ──

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // --- Background ---
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Gold radial glow (subtle)
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 450);
  glow.addColorStop(0, 'rgba(230, 185, 77, 0.07)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- Top branding ---
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`HELM WRAPPED  \u00B7  ${data.year}`, W / 2, 80);

  // --- Slide-specific content ---
  switch (data.slideType) {
    case 'return':
      drawReturn(ctx, W, H, data);
      break;
    case 'bestWorst':
      drawBestWorst(ctx, W, H, data);
      break;
    case 'personality':
      drawPersonality(ctx, W, H, data);
      break;
    case 'habits':
      drawHabits(ctx, W, H, data);
      break;
    case 'sectors':
      drawSectors(ctx, W, H, data);
      break;
    case 'summary':
      drawSummary(ctx, W, H, data);
      break;
  }

  // --- Bottom branding ---
  // Gold dot
  ctx.beginPath();
  ctx.arc(W / 2, H - 60, 4, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  // URL
  ctx.fillStyle = MUTED;
  ctx.font = '500 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('helmterminal.dev/wrapped', W / 2, H - 30);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
