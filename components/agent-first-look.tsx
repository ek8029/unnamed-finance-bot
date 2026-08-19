'use client';

// "The agent's first look" — shown on Overview once holdings exist, until
// dismissed. This is the deterministic conversion moment: real dollar findings
// seconds after connect, instead of waiting weeks for an event catch. Headline
// numbers free; the linked surfaces carry the gates.

import { useEffect, useState } from 'react';
import { GhostFirstLook } from '@/components/ghost';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const LS_KEY = 'helm_first_look_dismissed';

interface FirstLook {
  ready: boolean;
  positions?: number;
  tlh?: { savings: number; losses: number; count: number };
  concentration?: { ticker: string; pct: number };
}

export function AgentFirstLook() {
  const router = useRouter();
  const [data, setData] = useState<FirstLook | null>(null);
  const [pending, setPending] = useState(true);
  const [dismissed, setDismissed] = useState(true); // default hidden until localStorage read

  useEffect(() => {
    try { setDismissed(localStorage.getItem(LS_KEY) === '1'); } catch { setDismissed(false); }
  }, []);

  useEffect(() => {
    if (dismissed) { setPending(false); return; }
    let active = true;
    fetch('/api/scan/first-look')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FirstLook | null) => {
        if (active && d?.ready) {
          setData(d);
          try { posthog.capture('scan_viewed'); } catch { /* analytics only */ }
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [dismissed]);

  if (dismissed) return null;
  if (pending) return <GhostFirstLook />;
  if (!data?.ready) return null;

  const findings: { label: string; value: string; detail: string; href: string; cta: string }[] = [];
  if (data.tlh && data.tlh.savings > 0) {
    findings.push({
      label: 'Tax-loss harvesting',
      value: `$${data.tlh.savings.toLocaleString('en-US')}`,
      detail: `estimated offsettable tax across ${data.tlh.count} position${data.tlh.count === 1 ? '' : 's'} at a loss`,
      href: '/dashboard/taxes',
      cta: 'See the work-through',
    });
  }
  if (data.concentration && data.concentration.pct >= 15) {
    findings.push({
      label: 'Concentration',
      value: `${data.concentration.ticker} · ${data.concentration.pct}%`,
      detail: 'of your book rides one name',
      href: '/dashboard/portfolio?tab=Concentration',
      cta: 'See the exposure',
    });
  }
  if (findings.length === 0) return null;

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* private mode */ }
    setDismissed(true);
  };

  return (
    <section
      aria-label="The agent's first look at your portfolio"
      className="mb-3.5 rounded-lg border border-[rgba(230,185,77,0.22)] bg-[rgba(230,185,77,0.04)] px-5 py-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
          ✦ The agent&apos;s first look · {data.positions} positions read
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-[18px] leading-none text-[#6A6A6A] hover:text-[#FAFAFA] transition-colors"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {findings.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              try { posthog.capture('scan_upgrade_clicked', { finding: f.label }); } catch { /* analytics only */ }
              router.push(f.href);
            }}
            className="rounded-md border border-white/[0.07] bg-[#131313] px-4 py-3.5 text-left transition-colors hover:border-[rgba(230,185,77,0.35)]"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] mb-1" style={MONO}>
              {f.label}
            </div>
            <div className="text-[19px] font-bold tabular-nums text-[var(--color-text-primary)]">{f.value}</div>
            <div className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">{f.detail}</div>
            <div className="font-mono text-[11px] text-[var(--color-gold)] mt-2" style={MONO}>{f.cta} →</div>
          </button>
        ))}
      </div>
      <p className="m-0 mt-2.5 text-[10px] text-[var(--color-text-muted)]">
        Estimates from your live book. Not financial or tax advice.
      </p>
    </section>
  );
}
