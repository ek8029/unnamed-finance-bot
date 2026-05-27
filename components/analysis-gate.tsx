'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import posthog from 'posthog-js';

type GateState = 'loading' | 'allowed' | 'anon-blocked' | 'free-blocked';

const ANON_STORAGE_KEY = 'helm_anon_analyses';
const ANON_DAILY_LIMIT = 1;

function getAnonUsage(): { date: string; count: number } {
  try {
    const raw = localStorage.getItem(ANON_STORAGE_KEY);
    if (!raw) return { date: '', count: 0 };
    return JSON.parse(raw);
  } catch {
    return { date: '', count: 0 };
  }
}

function incrementAnonUsage(): void {
  const today = new Date().toISOString().slice(0, 10);
  const current = getAnonUsage();
  const count = current.date === today ? current.count + 1 : 1;
  localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify({ date: today, count }));
}

export function AnalysisGate() {
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Try fetching tier (will 401 if not logged in)
      try {
        const res = await fetch('/api/user/tier');

        if (res.status === 401) {
          // Anonymous user — check localStorage
          const today = new Date().toISOString().slice(0, 10);
          const usage = getAnonUsage();
          const todayCount = usage.date === today ? usage.count : 0;

          if (todayCount > ANON_DAILY_LIMIT) {
            posthog.capture('analyze_gate_hit', { gate: 'anon' });
            if (!cancelled) setState('anon-blocked');
          } else {
            incrementAnonUsage();
            if (!cancelled) setState('allowed');
          }
          return;
        }

        if (!res.ok) {
          // Unexpected error — fail open (don't block)
          if (!cancelled) setState('allowed');
          return;
        }

        const data = await res.json();

        if (data.tier === 'pro') {
          if (!cancelled) setState('allowed');
          return;
        }

        // Free tier — check quota
        const remaining = data.quota?.remaining ?? 1;
        if (remaining <= 0) {
          posthog.capture('analyze_gate_hit', { gate: 'free' });
          if (!cancelled) setState('free-blocked');
        } else {
          // Record this usage server-side
          fetch('/api/analyze/record-usage', { method: 'POST' }).catch(() => {});
          posthog.capture('analyze_used', { tier: data.tier, remaining: remaining - 1 });
          if (!cancelled) setState('allowed');
        }
      } catch {
        // Network error — fail open
        if (!cancelled) setState('allowed');
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  // Don't render anything while loading or if allowed
  if (state === 'loading' || state === 'allowed') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blur backdrop */}
      <div className="absolute inset-0 backdrop-blur-md bg-[var(--color-bg-base)]/80" />

      {/* Gate card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-[var(--radius-md)] border border-[var(--color-border-base)] bg-[var(--color-bg-base)]">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <HelmMark size={24} />
          <div className="h-px flex-1 bg-[var(--color-border-base)]" />
          <span
            className="text-[12px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {state === 'anon-blocked' ? 'Free' : 'Pro'}
          </span>
        </div>

        {state === 'anon-blocked' ? (
          <>
            <h2 className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
              You&apos;ve used your free analysis
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
              Create a free Helm account to get 5 AI-powered stock analyses per day. No credit card required.
            </p>
            <Link
              href="/signup"
              className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] transition-colors duration-200 mb-4"
            >
              Create free account
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              <Link
                href="/login"
                className="hover:text-[var(--color-text-secondary)] transition-colors duration-150"
              >
                Already have an account? Log in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
              Daily analysis limit reached
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
              You&apos;ve used all 5 free analyses for today. Upgrade to Helm Pro for unlimited AI-powered stock analysis.
            </p>
            <Link
              href="/dashboard/settings"
              className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] transition-colors duration-200 mb-4"
            >
              Upgrade to Pro
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              <Link
                href="/dashboard"
                className="hover:text-[var(--color-text-secondary)] transition-colors duration-150"
              >
                &larr; Back to dashboard
              </Link>
              <span>Resets daily at midnight UTC</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
