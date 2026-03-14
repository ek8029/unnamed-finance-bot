'use client';

import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-md">
        <p className="font-mono text-[var(--color-negative)] text-[13px] uppercase tracking-wider mb-4">
          Dashboard Error
        </p>
        <h2 className="font-sans font-semibold text-[22px] text-[var(--color-text-primary)] tracking-tight mb-3">
          Something went wrong
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">
          This page encountered an error. Your data is safe — try refreshing.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="text-[14px] bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-text-inverse)] font-medium px-5 py-2 rounded-sm transition-colors"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
