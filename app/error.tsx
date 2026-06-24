'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[var(--color-negative)] text-[14px] uppercase tracking-wider mb-4">
          Something went wrong
        </p>
        <h1 className="font-sans font-bold text-[28px] text-[var(--color-text-primary)] tracking-tight mb-3">
          Unexpected error
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          We hit an issue loading this page. Try refreshing, or head back to the homepage.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="text-[15px] bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-text-inverse)] font-medium px-5 py-2 rounded-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
