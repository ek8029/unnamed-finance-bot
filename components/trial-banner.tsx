// Slim strip shown while a Plaid-connect Pro trial is running. Days-left
// countdown + upgrade link; renders nothing for non-trial users.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function TrialBanner() {
  const [endsAt, setEndsAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/user/tier')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.trialEndsAt) setEndsAt(d.trialEndsAt); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!endsAt) return null;
  const daysLeft = Math.max(1, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="mb-3.5 flex items-center gap-3 rounded-lg border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-2.5">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)] shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
        Pro trial
      </span>
      <span className="text-[13.5px] text-[var(--color-text-secondary)] min-w-0 truncate">
        Full intelligence unlocked. {daysLeft} day{daysLeft === 1 ? '' : 's'} left.
      </span>
      <Link
        href="/pricing"
        className="ml-auto shrink-0 font-mono text-[12.5px] font-semibold text-[var(--color-gold)] hover:underline"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Keep it &rarr;
      </Link>
    </div>
  );
}
