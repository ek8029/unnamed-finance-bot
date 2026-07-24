'use client';

// The lab shell's account switcher. Persists the chosen account in a cookie so
// every page under /testing/app reads the same book — that's what makes the
// shell feel like the product instead of a pile of ?email= links.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function AccountPicker({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [editing, setEditing] = useState(!current);
  const router = useRouter();

  function apply() {
    const email = value.trim().toLowerCase();
    if (!email) return;
    // Dev-only cookie, site-wide path: the REAL /dashboard pages read it too
    // (read-only impersonation in lib/supabase/server, NODE_ENV-gated). Not a
    // credential — it does nothing on production builds.
    document.cookie = `helm_lab_email=${encodeURIComponent(email)}; path=/; max-age=2592000; samesite=lax`;
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left rounded-md border border-white/[0.08] bg-[#0B0B0B] px-3 py-2.5 hover:border-white/[0.16] transition-colors"
      >
        <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>Viewing as</div>
        <div className="mt-0.5 text-[12px] text-[#FAFAFA] truncate" style={MONO}>{current}</div>
        <div className="mt-0.5 text-[10px] text-[#E6B94D]" style={MONO}>switch account</div>
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[rgba(230,185,77,0.3)] bg-[#0B0B0B] p-2.5">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#6A6A6A] mb-1.5" style={MONO}>Account email</div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        placeholder="someone@example.com"
        autoFocus
        className="w-full bg-[#060606] border border-white/[0.1] rounded px-2 py-1.5 text-[12px] text-[#FAFAFA] outline-none focus:border-[rgba(230,185,77,0.4)]"
        style={MONO}
      />
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="px-2.5 py-1 rounded bg-[#E6B94D] text-[#060606] text-[11px] font-semibold"
          style={MONO}
        >
          View
        </button>
        {current && (
          <button
            type="button"
            onClick={() => { setValue(current); setEditing(false); }}
            className="px-2 py-1 text-[11px] text-[#8A8A8A] hover:text-[#FAFAFA]"
            style={MONO}
          >
            cancel
          </button>
        )}
      </div>
    </div>
  );
}
