'use client';

// Fixed pill shown while dev-only lab impersonation is active, so a localhost
// session browsing another account's book can never be mistaken for a real
// login. Renders nothing on production builds (NODE_ENV is inlined) and
// nothing when the cookie is absent.

import { useEffect, useState } from 'react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function LabImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)helm_lab_email=([^;]+)/);
    setEmail(m ? decodeURIComponent(m[1]) : null);
  }, []);

  if (process.env.NODE_ENV === 'production' || !email) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 rounded-full border border-[rgba(230,185,77,0.45)] bg-[#131313] pl-3.5 pr-2 py-2 shadow-lg"
      style={MONO}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#E6B94D] animate-pulse" />
      <span className="text-[11px] text-[#E6B94D] font-semibold uppercase tracking-[0.1em]">Lab</span>
      <span className="text-[11.5px] text-[#C8C8C8] max-w-[220px] truncate">viewing as {email} · read-only</span>
      <button
        type="button"
        onClick={() => {
          document.cookie = 'helm_lab_email=; path=/; max-age=0';
          window.location.reload();
        }}
        className="px-2 py-1 rounded-full text-[10.5px] font-semibold text-[#060606] bg-[#E6B94D] hover:brightness-110"
      >
        exit
      </button>
    </div>
  );
}
