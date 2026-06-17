'use client';

// One-time "what's new" nudge for allowlisted beta users who onboarded before the
// thesis layer existed. Drives the first click into /theses (where the activation
// flow takes over). Dismiss or click-through writes localStorage so it shows once.
// Gating (isThesisUser) is done by the parent so this never advertises a locked door.
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const KEY = 'helm_theses_whatsnew';
const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function ThesesWhatsNewBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(KEY) !== '1') setShow(true); } catch {}
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setShow(false);
  };

  return (
    <div className="relative flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-[rgba(230,185,77,0.18)] bg-[rgba(230,185,77,0.06)]">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-gold)]" aria-hidden />
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-[var(--color-gold)] text-black" style={MONO}>New</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#FAFAFA] leading-[1.3] m-0">Your conviction, watched.</p>
        <p className="text-[12.5px] text-[#9A9A9A] leading-[1.4] mt-0.5 m-0">
          Helm&apos;s new agentic layer monitors filings, news and price against the <span className="italic">why</span> behind every position, and flags what strengthens or breaks it. Sourced, dated, every market hour.
        </p>
      </div>
      <Link
        href="/dashboard/theses"
        onClick={dismiss}
        className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded bg-transparent text-[var(--color-gold)] border border-[rgba(230,185,77,0.4)] hover:bg-[rgba(230,185,77,0.12)] transition-colors"
        style={MONO}
      >
        Open Theses &rarr;
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[#6A6A6A] hover:text-[#FAFAFA] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
