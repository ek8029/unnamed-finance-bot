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

import { createContext, useContext, useEffect, useState } from 'react';
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
  // Default to the full premium experience; toggle down to test locks/empties.
  const [tier, setTierState] = useState<Tier>('max');
  const [dataState, setDataStateState] = useState<DataState>('connected');

  useEffect(() => {
    const t = localStorage.getItem(LS_TIER) as Tier | null;
    const d = localStorage.getItem(LS_DS) as DataState | null;
    if (t === 'free' || t === 'pro' || t === 'max') setTierState(t);
    if (d === 'connected' || d === 'demo' || d === 'empty') setDataStateState(d);
  }, []);

  const setTier = (t: Tier) => { setTierState(t); localStorage.setItem(LS_TIER, t); };
  const setDataState = (d: DataState) => { setDataStateState(d); localStorage.setItem(LS_DS, d); };

  return <Ctx.Provider value={{ tier, dataState, setTier, setDataState }}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePreview must be used within PreviewProvider');
  return c;
}
