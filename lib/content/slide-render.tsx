import { ImageResponse } from 'next/og';
import { toSlides, type SlideModel } from '@/lib/content/slides';

// ---- Brand system ----
const BG = '#060606';
const TEXT = '#FAFAFA';
const TEXT_2 = '#C8C8C8';
const MUTED = '#7A7A7A';
const GOLD = '#E6B94D';
const GREEN = '#4ADE80';
const RED = '#F87171';
const HAIRLINE = 'rgba(230, 185, 77, 0.28)';

const W = 1080;
const H = 1350;
const PAD = 84;

// Static TTF instances (Satori needs ArrayBuffers + real static weights; never throw if a fetch fails).
const FONT_SOURCES = {
  groteskBold:
    'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf',
  groteskMedium:
    'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-500-normal.ttf',
  manropeRegular:
    'https://cdn.jsdelivr.net/fontsource/fonts/manrope@latest/latin-400-normal.ttf',
  serif:
    'https://cdn.jsdelivr.net/fontsource/fonts/instrument-serif@latest/latin-400-normal.ttf',
};

async function loadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export interface EventRow {
  ticker: string | null;
  company: string | null;
  verdict: 'supports' | 'contradicts' | 'neutral' | string | null;
  verbatim_cite: string | null;
  cite_date: string | null;
  source_url: string | null;
  pillar_claim: string | null;
}

function fmtDate(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}

function domainOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return '';
  }
}

function verdictStyle(verdict: string | null): { label: string; color: string } {
  switch (verdict) {
    case 'supports':
      return { label: 'CONFIRMED', color: GREEN };
    case 'contradicts':
      return { label: 'THESIS HIT', color: RED };
    default:
      return { label: 'WATCH', color: GOLD };
  }
}

const G = 'Grotesk';
const M = 'Manrope';
const S = 'Serif';

// ---- Shared chrome ----
function TopBar({ ticker, idx }: { ticker: string; idx: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: G,
            fontWeight: 700,
            fontSize: 24,
            color: TEXT,
            letterSpacing: '0.22em',
          }}
        >
          HELM TERMINAL
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: G,
            fontWeight: 500,
            fontSize: 24,
            color: MUTED,
            letterSpacing: '0.14em',
          }}
        >
          {ticker ? `${ticker} · ` : ''}
          {String(idx + 1).padStart(2, '0')}/06
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          height: 1,
          width: '100%',
          marginTop: 24,
          background: HAIRLINE,
        }}
      />
    </div>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: G,
        fontSize: 22,
        color: MUTED,
        letterSpacing: '0.16em',
      }}
    >
      {text}
    </div>
  );
}

function Label({ text, color = GOLD }: { text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <div style={{ display: 'flex', width: 36, height: 3, background: color, marginRight: 18 }} />
      <div
        style={{
          display: 'flex',
          fontFamily: G,
          fontWeight: 700,
          fontSize: 24,
          color,
          letterSpacing: '0.26em',
        }}
      >
        {text}
      </div>
    </div>
  );
}

// Oversized ghosted ticker watermark for depth.
function GhostTicker({ text, color = GOLD }: { text: string; color?: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        bottom: -90,
        right: -40,
        fontFamily: G,
        fontWeight: 700,
        fontSize: 460,
        lineHeight: 1,
        color,
        opacity: 0.05,
        letterSpacing: '-0.04em',
      }}
    >
      {text}
    </div>
  );
}

function Shell({
  children,
  ticker,
  idx,
  footer = 'helmterminal.dev',
  ghost,
  ghostColor,
  accent,
}: {
  children: React.ReactNode;
  ticker: string;
  idx: number;
  footer?: string;
  ghost?: string;
  ghostColor?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: PAD,
        background: `linear-gradient(150deg, #0c0b08 0%, ${BG} 40%, ${accent || 'rgba(230,185,77,0.12)'} 108%)`,
      }}
    >
      <GhostTicker text={ghost || ''} color={ghostColor} />
      <TopBar ticker={ticker} idx={idx} />
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>{children}</div>
      <Footer text={footer} />
    </div>
  );
}

// ---- Per-kind layouts ----
function HookSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  return (
    <Shell ticker={ev.ticker || ''} idx={slide.index} ghost={ev.ticker || ''}>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: G,
              fontWeight: 700,
              fontSize: 34,
              color: BG,
              background: GOLD,
              padding: '12px 22px',
              borderRadius: 10,
              letterSpacing: '0.04em',
            }}
          >
            {ev.ticker || 'HELM'}
          </div>
          {ev.company ? (
            <div
              style={{
                display: 'flex',
                fontFamily: M,
                fontSize: 30,
                color: TEXT_2,
                marginLeft: 24,
              }}
            >
              {ev.company}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: S,
            fontWeight: 400,
            fontSize: 88,
            color: TEXT,
            lineHeight: 1.06,
            letterSpacing: '-0.01em',
          }}
        >
          {slide.title}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: G,
            fontWeight: 500,
            fontSize: 24,
            color: GOLD,
            letterSpacing: '0.26em',
            marginTop: 44,
          }}
        >
          THESIS WATCH
        </div>
      </div>
    </Shell>
  );
}

function PillarSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  const claim = ev.pillar_claim || slide.body;
  return (
    <Shell ticker={ev.ticker || ''} idx={slide.index} ghost={ev.ticker || ''}>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        <Label text="THE THESIS" />
        <div
          style={{
            display: 'flex',
            fontFamily: S,
            fontWeight: 400,
            fontSize: 70,
            color: TEXT,
            lineHeight: 1.14,
            letterSpacing: '-0.005em',
            marginTop: 40,
          }}
        >
          {claim}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: M,
            fontSize: 26,
            color: MUTED,
            letterSpacing: '0.04em',
            marginTop: 40,
          }}
        >
          The reason to own it.
        </div>
      </div>
    </Shell>
  );
}

function EventSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  return (
    <Shell ticker={ev.ticker || ''} idx={slide.index} ghost={ev.ticker || ''}>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        <Label text="WHAT HAPPENED" />
        {slide.title ? (
          <div
            style={{
              display: 'flex',
              fontFamily: S,
              fontWeight: 400,
              fontSize: 60,
              color: TEXT,
              lineHeight: 1.12,
              letterSpacing: '-0.005em',
              marginTop: 36,
            }}
          >
            {slide.title}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontFamily: M,
            fontSize: 36,
            color: TEXT_2,
            lineHeight: 1.42,
            marginTop: 28,
          }}
        >
          {slide.body}
        </div>
      </div>
    </Shell>
  );
}

function CiteSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  const quote = ev.verbatim_cite || slide.body;
  const date = fmtDate(ev.cite_date);
  const src = domainOf(ev.source_url);
  const chip = [src, date].filter(Boolean).join('  ·  ');
  return (
    <Shell ticker={ev.ticker || ''} idx={slide.index} ghost="" accent="rgba(230,185,77,0.07)">
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            fontFamily: S,
            fontSize: 240,
            lineHeight: 0.7,
            color: GOLD,
            height: 110,
            marginBottom: 8,
          }}
        >
          {'“'}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: S,
            fontSize: 60,
            color: TEXT,
            lineHeight: 1.22,
            letterSpacing: '-0.005em',
          }}
        >
          {quote}
        </div>
        {chip ? (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 52 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: G,
                fontWeight: 500,
                fontSize: 24,
                color: GOLD,
                letterSpacing: '0.1em',
                padding: '14px 22px',
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 8,
              }}
            >
              {chip}
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontFamily: M,
            fontSize: 22,
            color: MUTED,
            letterSpacing: '0.04em',
            marginTop: 24,
          }}
        >
          Verbatim. Dated. Sourced.
        </div>
      </div>
    </Shell>
  );
}

function VerdictSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  const v = verdictStyle(ev.verdict);
  return (
    <Shell
      ticker={ev.ticker || ''}
      idx={slide.index}
      ghost={ev.ticker || ''}
      ghostColor={v.color}
      accent={`${v.color}14`}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: G,
            fontWeight: 700,
            fontSize: 64,
            color: BG,
            background: v.color,
            padding: '28px 56px',
            borderRadius: 18,
            letterSpacing: '0.06em',
          }}
        >
          {v.label}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: M,
            fontSize: 36,
            color: TEXT_2,
            lineHeight: 1.4,
            textAlign: 'center',
            marginTop: 56,
            maxWidth: 760,
          }}
        >
          {slide.body}
        </div>
      </div>
    </Shell>
  );
}

function CtaSlide({ slide, ev }: { slide: SlideModel; ev: EventRow }) {
  return (
    <Shell ticker={ev.ticker || ''} idx={slide.index} footer="@helmterminal" ghost="HELM">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: S,
            fontWeight: 400,
            fontSize: 80,
            color: TEXT,
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
          }}
        >
          {slide.title || 'Run any ticker, free.'}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: M,
            fontSize: 34,
            color: TEXT_2,
            lineHeight: 1.4,
            marginTop: 28,
            maxWidth: 820,
          }}
        >
          {slide.body}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: G,
            fontWeight: 700,
            fontSize: 40,
            color: BG,
            background: GOLD,
            padding: '20px 36px',
            borderRadius: 12,
            letterSpacing: '0.02em',
            marginTop: 56,
          }}
        >
          helmterminal.dev/analyze
        </div>
      </div>
    </Shell>
  );
}

function renderSlide(slide: SlideModel, ev: EventRow) {
  switch (slide.kind) {
    case 'hook':
      return <HookSlide slide={slide} ev={ev} />;
    case 'pillar':
      return <PillarSlide slide={slide} ev={ev} />;
    case 'event':
      return <EventSlide slide={slide} ev={ev} />;
    case 'cite':
      return <CiteSlide slide={slide} ev={ev} />;
    case 'verdict':
      return <VerdictSlide slide={slide} ev={ev} />;
    case 'cta':
      return <CtaSlide slide={slide} ev={ev} />;
    default:
      return <EventSlide slide={slide} ev={ev} />;
  }
}

export { renderSlide };

export async function buildSlideImage(slide: SlideModel, ev: EventRow): Promise<ImageResponse> {
  // Load custom fonts; on any failure we still render with sans-serif fallback.
  const [groteskBold, groteskMedium, manrope, serif] = await Promise.all([
    loadFont(FONT_SOURCES.groteskBold),
    loadFont(FONT_SOURCES.groteskMedium),
    loadFont(FONT_SOURCES.manropeRegular),
    loadFont(FONT_SOURCES.serif),
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: 'normal' }[] = [];
  if (groteskMedium) {
    fonts.push({ name: G, data: groteskMedium, weight: 500, style: 'normal' });
  }
  if (groteskBold) {
    fonts.push({ name: G, data: groteskBold, weight: 700, style: 'normal' });
  }
  if (manrope) {
    fonts.push({ name: M, data: manrope, weight: 400, style: 'normal' });
  }
  if (serif) {
    fonts.push({ name: S, data: serif, weight: 400, style: 'normal' });
  }

  return new ImageResponse(renderSlide(slide, ev), {
    width: W,
    height: H,
    ...(fonts.length ? { fonts } : {}),
  });
}
