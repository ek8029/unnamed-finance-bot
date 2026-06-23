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

import { createContext, useContext, useState } from 'react';
import type { Tier } from '@/lib/tier-shared';

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
  const [tier, setTierState] = useState<Tier>(() => {
    if (typeof window === 'undefined') return 'max';
    const t = localStorage.getItem(LS_TIER);
    return t === 'free' || t === 'pro' || t === 'max' ? t : 'max';
  });
  const [dataState, setDataStateState] = useState<DataState>(() => {
    if (typeof window === 'undefined') return 'connected';
    const d = localStorage.getItem(LS_DS);
    return d === 'connected' || d === 'demo' || d === 'empty' ? d : 'connected';
  });

  const setTier = (t: Tier) => { setTierState(t); localStorage.setItem(LS_TIER, t); };
  const setDataState = (d: DataState) => { setDataStateState(d); localStorage.setItem(LS_DS, d); };

  return <Ctx.Provider value={{ tier, dataState, setTier, setDataState }}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePreview must be used within PreviewProvider');
  return c;
}
