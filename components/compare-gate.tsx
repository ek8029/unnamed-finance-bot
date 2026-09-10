'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import posthog from 'posthog-js';
import { cachedGet } from '@/lib/api-cache';

type GateState = 'loading' | 'allowed' | 'anon-blocked' | 'free-blocked';

const ANON_STORAGE_KEY = 'helm_anon_compares';
const ANON_DAILY_LIMIT = 1;
const FREE_DAILY_LIMIT = 2;

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

export function CompareGate() {
  const [state, setState] = useState<GateState>('loading');
  const pathname = usePathname();
  const gateDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state.endsWith('blocked') && gateDialog.current && !gateDialog.current.open) gateDialog.current.showModal();
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await cachedGet<{ tier?: string }>('/api/user/tier');
        if (cancelled) return;

        if (res.status === 401) {
          const today = new Date().toISOString().slice(0, 10);
          const usage = getAnonUsage();
          const todayCount = usage.date === today ? usage.count : 0;

          if (todayCount >= ANON_DAILY_LIMIT) {
            posthog.capture('compare_gate_hit', { gate: 'anon' });
            if (!cancelled) setState('anon-blocked');
          } else {
            incrementAnonUsage();
            if (!cancelled) setState('allowed');
          }
          return;
        }

        if (!res.ok || !res.data) {
          if (!cancelled) setState('allowed');
          return;
        }

        const data = res.data;
        if (cancelled) return;

        if (data.tier === 'pro' || data.tier === 'max') {
          if (!cancelled) setState('allowed');
          return;
        }

        // Free tier: check compare usage from localStorage
        const today = new Date().toISOString().slice(0, 10);
        const usage = getAnonUsage();
        const todayCount = usage.date === today ? usage.count : 0;

        if (todayCount >= FREE_DAILY_LIMIT) {
          posthog.capture('compare_gate_hit', { gate: 'free' });
          if (!cancelled) setState('free-blocked');
        } else {
          incrementAnonUsage();
          if (!cancelled) setState('allowed');
        }
      } catch {
        if (!cancelled) setState('allowed');
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading' || state === 'allowed') return null;

  return (
    <dialog ref={gateDialog} className="helm-research-gate" aria-labelledby="comparison-limit-title" onCancel={e => { e.preventDefault(); window.location.assign('/compare'); }}>
      <div>
        <div className="flex items-center gap-3 mb-8">
          <HelmMark size={24} />
          <div className="h-px flex-1 bg-[var(--color-border-base)]" />
          <span
            className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {state === 'anon-blocked' ? 'Free' : 'Pro'}
          </span>
        </div>

        {state === 'anon-blocked' ? (
          <>
            <h2 id="comparison-limit-title" className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
              You&apos;ve used your free comparison
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
              Create a free Helm account to get 2 stock comparisons per day. No credit card required.
            </p>
            <Link
              href={`/signup?next=${encodeURIComponent(pathname)}`}
              className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] transition-colors duration-200 mb-4"
            >
              Create free account
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center justify-between text-[13px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              <Link
                href={`/login?redirect=${encodeURIComponent(pathname)}`}
                className="hover:text-[var(--color-text-secondary)] transition-colors duration-150"
              >
                Already have an account? Log in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="comparison-limit-title" className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
              Daily comparison limit reached
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
              You&apos;ve used both free comparisons for today. Upgrade to Pro for unlimited stock comparisons.
            </p>
            <Link
              href="/pricing"
              className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] transition-colors duration-200 mb-4"
            >
              Upgrade to Pro · $20/mo
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center justify-between text-[13px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
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
        <Link href="/compare" className="helm-gate-back">← Back to comparisons</Link>
      </div>
    </dialog>
  );
}
