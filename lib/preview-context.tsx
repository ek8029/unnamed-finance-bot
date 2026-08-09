'use client';
// Preview context for the dashboard redesign (branch: redesign/dashboard).
//
// Holds a tier (free|pro|max) + dataState (connected|demo|empty) that the new
// screens read as their source of truth so every locked/empty state is testable
// on localhost via the floating PreviewToggle, WITHOUT a Stripe sub or DB row.
//
// PRODUCTION NOTE: this is dev scaffolding. In the pricing phase, `tier` should
// initialize from real entitlements (useTier) and `dataState` from real
// account-connection status; the toggle becomes dev-only / removed.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import type { Tier } from '@/lib/tier-shared';

// In production the gates must reflect the user's REAL entitlement, not the dev
// toggle. Dev keeps the localStorage-backed toggle for testing locks/empties.
const IS_PROD = process.env.NODE_ENV === 'production';

export type DataState = 'connected' | 'demo' | 'empty';

interface PreviewCtx {
  tier: Tier;
  dataState: DataState;
  setTier: (t: Tier) => void;
  setDataState: (d: DataState) => void;
}

const Ctx = createContext<PreviewCtx | null>(null);
const LS_TIER = 'helm-preview-tier';
const LS_DS = 'helm-preview-datastate';

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init from localStorage so the FIRST client render already has the real
  // preview tier — no default-then-correct flash that briefly unlocks gated
  // surfaces (e.g. Factor Lens) before the lock paints. Defaults to the full
  // premium experience on the server / when nothing is stored.
  // Prod: gate-first (free) until the real entitlement loads — never leak paid
  // content to a free user on first paint. Dev: localStorage toggle, applied in
  // an effect AFTER hydration — reading localStorage in the initializer made the
  // server render (always 'pro') disagree with the client and threw hydration
  // errors on every dashboard page in dev.
  const [tier, setTierState] = useState<Tier>(IS_PROD ? 'free' : 'pro');
  const [dataState, setDataStateState] = useState<DataState>('connected');
  useEffect(() => {
    if (IS_PROD) return;
    try {
      const t = localStorage.getItem(LS_TIER);
      if (t === 'free' || t === 'pro') setTierState(t);
      const d = localStorage.getItem(LS_DS);
      if (d === 'connected' || d === 'demo' || d === 'empty') setDataStateState(d);
    } catch { /* ignore */ }
  }, []);

  // Production: real subscription tier is the source of truth.
  //
  // This provider mounts at the ROOT (login page included), so the first fetch can
  // run before any session exists (401), and password login is a server POST +
  // client-side router.push — no remount, no client-side Supabase auth event. The
  // old one-shot fetch therefore left a paying user stuck on tier='free' for the
  // whole session (Lindzon bug). Fix: re-run the fetch on every route change until
  // a real tier answer lands, retrying transient 401s on authed surfaces.
  const pathname = usePathname();
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (!IS_PROD || resolvedRef.current) return;
    let cancelled = false;
    // /dashboard sits behind auth middleware, so a 401 there is a cookie race
    // worth retrying; on public pages a 401 just means logged out.
    const attempts = pathname?.startsWith('/dashboard') ? 3 : 1;

    (async () => {
      for (let attempt = 1; attempt <= attempts && !cancelled; attempt++) {
        try {
          const r = await fetch('/api/user/tier');
          if (r.ok) {
            const d = await r.json();
            if (!cancelled && (d?.tier === 'free' || d?.tier === 'pro' || d?.tier === 'max')) {
              resolvedRef.current = true;
              setTierState(d.tier);
              // Stamp the real entitlement onto the person. Person-on-events is
              // enabled on this project, so every event ingested after this
              // point carries the tier it was sent under, which is the only way
              // to tell a free user's funnel from a trialing one's. `realTier`
              // rather than `tier`: a trial row reads as pro for features, but
              // for analytics we want what the table says, plus the trial date
              // to separate trialing from paid.
              posthog.setPersonProperties({
                tier: d.realTier ?? d.tier,
                trial_ends_at: d.trialEndsAt ?? null,
              });
            }
            return;
          }
          if (r.status !== 401) return;
        } catch { /* retry */ }
        await new Promise((res) => setTimeout(res, 400 * attempt));
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  const setTier = (t: Tier) => { setTierState(t); if (!IS_PROD) localStorage.setItem(LS_TIER, t); };
  const setDataState = (d: DataState) => { setDataStateState(d); if (!IS_PROD) localStorage.setItem(LS_DS, d); };

  return <Ctx.Provider value={{ tier, dataState, setTier, setDataState }}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePreview must be used within PreviewProvider');
  return c;
}
