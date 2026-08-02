// Trial lifecycle strip, rendered in the dashboard layout on every page.
// Three states: countdown while a Pro trial runs, an urgent tone in the last
// 48 hours, and — for 7 days after a never-paid trial lapses — the value
// receipt: what Helm actually surfaced during the trial, with the keep-it
// link. A silent lapse converts nobody.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function TrialBanner() {
  const [tierData, setTierData] = useState<{ trialEndsAt: string | null; lapsedTrialEndedAt: string | null } | null>(null);
  const [receipt, setReceipt] = useState<{ surfacedTotal: number; findings: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/user/tier')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setTierData({ trialEndsAt: d.trialEndsAt ?? null, lapsedTrialEndedAt: d.lapsedTrialEndedAt ?? null });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const lapsedAt = tierData?.lapsedTrialEndedAt ? new Date(tierData.lapsedTrialEndedAt).getTime() : null;
  const lapsedDaysAgo = lapsedAt != null ? (Date.now() - lapsedAt) / 86_400_000 : null;
  const showReceipt = lapsedDaysAgo != null && lapsedDaysAgo >= 0 && lapsedDaysAgo <= 7;

  useEffect(() => {
    if (!showReceipt) return;
    let alive = true;
    fetch('/api/user/trial-receipt')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setReceipt(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showReceipt]);

  if (!tierData) return null;

  // ── Active trial: countdown, urgent in the last 48h ──
  if (tierData.trialEndsAt) {
    const daysLeft = Math.max(1, Math.ceil((new Date(tierData.trialEndsAt).getTime() - Date.now()) / 86_400_000));
    const urgent = daysLeft <= 2;
    return (
      <div
        className="border-b"
        style={{
          background: urgent ? 'rgba(251,191,36,0.08)' : 'var(--color-gold-surface)',
          borderColor: urgent ? 'var(--color-warning-border)' : 'var(--color-gold-border)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em] shrink-0"
            style={{ ...MONO, color: urgent ? 'var(--color-warning-text)' : 'var(--color-gold)' }}
          >
            Pro trial
          </span>
          <span className="text-[13.5px] text-[var(--color-text-secondary)] min-w-0 truncate">
            {urgent
              ? daysLeft === 1
                ? 'Ends today. Everything Helm watches for you locks tonight.'
                : 'Ends tomorrow.'
              : `Full intelligence unlocked. ${daysLeft} days left.`}
          </span>
          <Link
            href="/pricing"
            className="ml-auto shrink-0 text-[12.5px] font-semibold hover:underline"
            style={{ ...MONO, color: urgent ? 'var(--color-warning-text)' : 'var(--color-gold)' }}
          >
            Keep it &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // ── Lapsed within 7 days: the value receipt ──
  if (showReceipt) {
    const endedDate = new Date(tierData.lapsedTrialEndedAt as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const hasNumbers = receipt != null && (receipt.surfacedTotal > 0 || receipt.findings > 0);
    return (
      <div className="border-b" style={{ background: 'var(--color-gold-surface)', borderColor: 'var(--color-gold-border)' }}>
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)] shrink-0" style={MONO}>
            Trial ended
          </span>
          <span className="text-[13.5px] text-[var(--color-text-secondary)] min-w-0 truncate">
            {hasNumbers ? (
              <>
                Ended {endedDate}. While it ran, Helm
                {receipt.surfacedTotal > 0 && (
                  <> flagged <span className="font-semibold text-[var(--color-text-primary)]">${receipt.surfacedTotal.toLocaleString()}</span> in potential tax savings</>
                )}
                {receipt.surfacedTotal > 0 && receipt.findings > 0 && ' and'}
                {receipt.findings > 0 && (
                  <> filed <span className="font-semibold text-[var(--color-text-primary)]">{receipt.findings} findings</span> on your positions</>
                )}
                .
              </>
            ) : (
              <>Ended {endedDate}. Your accounts stay connected — the intelligence layer is one step away.</>
            )}
          </span>
          <Link href="/pricing" className="ml-auto shrink-0 text-[12.5px] font-semibold text-[var(--color-gold)] hover:underline" style={MONO}>
            Keep the intelligence &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
