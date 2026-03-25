'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTier } from '@/hooks/use-tier';
import { ProGate } from '@/components/pro-gate';

import {
  type WrappedData,
  type CardType,
  MONO,
  Confetti,
  ProgressBar,
  LoadingState,
} from './wrapped-shared';
import { IntroCard, NetWorthCard, ReturnCard } from './wrapped-intro-cards';
import { BestTradeCard, SpyComparisonCard, WorstTradeCard } from './wrapped-performance-cards';
import { SectorBreakdownCard, TopHoldingsCard, DividendCard, TradingActivityCard, TaxSavingsCard } from './wrapped-breakdown-cards';
import { HealthScoreCard, PersonalityCard, SummaryCard } from './wrapped-summary-cards';

// ═══════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════

export default function WrappedPage() {
  const router = useRouter();
  const { isPro, loading: tierLoading } = useTier();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [period, setPeriod] = useState<'quarter' | 'year'>('quarter');
  const [touchStartX, setTouchStartX] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setCurrentCard(0);
    fetch(`/api/dashboard/wrapped?period=${period}`)
      .then(async res => {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body.code === 'PRO_REQUIRED') {
            setProRequired(true);
            setLoading(false);
            return null;
          }
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(d => { if (d) { setData(d); setLoading(false); } })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [period]);

  // Build cards dynamically (all hooks must be before conditional returns)
  const cards = useMemo<CardType[]>(() => {
    if (!data) return [];
    const c: CardType[] = ['intro'];
    if (data.netWorthChange.change !== 0) c.push('netWorth');
    c.push('return');
    if (data.bestPosition) c.push('best');
    if (data.spyComparison.beat !== null || data.spyComparison.userReturn !== 0) c.push('spy');
    if (data.worstPosition) c.push('worst');
    if (data.sectorBreakdown.length > 0) c.push('sectors');
    if (data.topHoldings.length > 0) c.push('topHoldings');
    if (data.totalDividends > 0) c.push('dividends');
    if (data.tradeCount > 0) c.push('trading');
    if (data.taxSavings > 0) c.push('tax');
    if (data.healthScoreTrend.start !== null || data.healthScoreTrend.end !== null) c.push('health');
    c.push('personality');
    c.push('summary');
    return c;
  }, [data]);

  // Determine if current card should show confetti
  const showConfetti = useMemo(() => {
    if (!data || cards.length === 0) return false;
    const type = cards[currentCard];
    return (
      type === 'best' ||
      type === 'personality' ||
      (type === 'return' && data.totalReturn.pct > 0) ||
      (type === 'spy' && data.spyComparison.beat === true)
    );
  }, [cards, currentCard, data]);

  // Trigger confetti remount on card change
  useEffect(() => {
    if (showConfetti) setConfettiKey(k => k + 1);
  }, [currentCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= cards.length) return;
    setCurrentCard(index);
  }, [cards.length]);

  const next = useCallback(() => goTo(currentCard + 1), [currentCard, goTo]);
  const prev = useCallback(() => goTo(currentCard - 1), [currentCard, goTo]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') router.push('/dashboard');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, router]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 60) next();
    if (diff < -60) prev();
  };

  // Click zones
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) prev();
    else next();
  };

  // Show upgrade wall if tier check says free OR if API returned PRO_REQUIRED
  if ((!tierLoading && !isPro) || proRequired) {
    return (
      <ProGate
        feature="Portfolio Wrapped"
        description="Your personalized portfolio recap — returns, top performers, investor personality, and more. Available on the Pro plan."
      />
    );
  }

  if (loading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-base)] flex flex-col items-center justify-center">
        <p className="text-[var(--color-text-secondary)] mb-4">Unable to generate your wrapped.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  function renderCard(type: CardType, active: boolean) {
    switch (type) {
      case 'intro':        return <IntroCard data={data!} active={active} />;
      case 'netWorth':     return <NetWorthCard data={data!} active={active} />;
      case 'return':       return <ReturnCard data={data!} active={active} />;
      case 'best':         return <BestTradeCard data={data!} active={active} />;
      case 'spy':          return <SpyComparisonCard data={data!} active={active} />;
      case 'worst':        return <WorstTradeCard data={data!} active={active} />;
      case 'sectors':      return <SectorBreakdownCard data={data!} active={active} />;
      case 'topHoldings':  return <TopHoldingsCard data={data!} active={active} />;
      case 'dividends':    return <DividendCard data={data!} active={active} />;
      case 'trading':      return <TradingActivityCard data={data!} active={active} />;
      case 'tax':          return <TaxSavingsCard data={data!} active={active} />;
      case 'health':       return <HealthScoreCard data={data!} active={active} />;
      case 'personality':  return <PersonalityCard data={data!} active={active} />;
      case 'summary':      return <SummaryCard data={data!} active={active} />;
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[var(--color-bg-base)] select-none overflow-hidden"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <ProgressBar total={cards.length} current={currentCard} />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); router.push('/dashboard'); }}
        className="absolute top-5 right-5 z-30 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Period toggle */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1 rounded-full bg-white/5 border border-white/10">
        {(['quarter', 'year'] as const).map(p => (
          <button
            key={p}
            onClick={(e) => { e.stopPropagation(); setPeriod(p); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors duration-200',
              period === p
                ? 'bg-[var(--color-gold)] text-black font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            )}
            style={MONO}
          >
            {p === 'quarter' ? 'Quarter' : 'Year'}
          </button>
        ))}
      </div>

      {/* Confetti overlay — skip when user prefers reduced motion */}
      {showConfetti && !reduceMotion && <Confetti key={confettiKey} />}

      {/* Card content */}
      <div className="absolute inset-0 pt-20">
        {cards.map((type, i) => (
          <div
            key={`${type}-${i}`}
            className={cn(
              'absolute inset-0',
              !reduceMotion && 'transition-[opacity,transform] duration-500 ease-out',
              i === currentCard
                ? 'opacity-100 scale-100 translate-x-0'
                : i < currentCard
                  ? 'opacity-0 scale-95 -translate-x-8 pointer-events-none'
                  : 'opacity-0 scale-95 translate-x-8 pointer-events-none',
            )}
          >
            {renderCard(type, i === currentCard)}
          </div>
        ))}
      </div>

      {/* Navigation arrows (desktop) */}
      {currentCard > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors hidden md:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {currentCard < cards.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors hidden md:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Card counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-[var(--color-text-muted)]"
           style={MONO}>
        {currentCard + 1} / {cards.length}
      </div>
    </div>
  );
}
