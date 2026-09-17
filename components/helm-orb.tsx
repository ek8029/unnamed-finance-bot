'use client';

// The thinking orb: Helm's signal that a model is working right now. Use it
// only where that is true (a scan, a draft, a research turn, an agent step).
// A page load, a table read or a stored digest keeps its spinner or skeleton;
// an orb over a database read would be a claim the product cannot back.
//
// Package: thinking-orbs (MIT, canvas 2D, no network, reduced-motion aware).
// It ships two hand-tuned sizes, 64 for a heading and 20 for an inline line,
// and paints monochrome. Gold comes from a CSS filter on the canvas; if it
// ever earns a real palette, that lives here and nowhere else.
//
// Decorative by contract: every placement sits beside text that already says
// what is happening, so the canvas is hidden from assistive tech.

import dynamic from 'next/dynamic';
import type { OrbSize, OrbState } from 'thinking-orbs';

export type { OrbState } from 'thinking-orbs';

const ThinkingOrb = dynamic(() => import('thinking-orbs').then((m) => m.ThinkingOrb), { ssr: false, loading: () => null });

const GOLD_FILTER = 'sepia(1) saturate(2.6) hue-rotate(-8deg) brightness(1.05)';

export function HelmOrb({ state, size = 20, className }: {
  state: OrbState;
  size?: OrbSize;
  className?: string;
}) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme="dark"
      aria-hidden="true"
      className={className}
      style={{ filter: GOLD_FILTER, flexShrink: 0 }}
    />
  );
}
