// Single source of truth for thesis status colors (intact/weakening/broken/watching).
// Shared by the theses page and the Why-I-Own-This detail so the two never drift.

export type PillarStatus = 'unverified' | 'intact' | 'weakening' | 'broken';

export const STATUS_META: Record<PillarStatus, { label: string; color: string }> = {
  intact:     { label: 'Intact',    color: '#4ADE80' },
  weakening:  { label: 'Weakening', color: '#E6B94D' },
  broken:     { label: 'Broken',    color: '#F87171' },
  unverified: { label: 'Watching',  color: '#6A6A6A' },
};

// Status dot glow (intact/weakening/broken lit; watching stays flat).
export function dotGlow(status: PillarStatus): string {
  return status === 'unverified' ? 'none' : `0 0 7px ${STATUS_META[status].color}`;
}

export const METER_ORDER: PillarStatus[] = ['broken', 'weakening', 'unverified', 'intact'];
export const METER_COLORS: Record<PillarStatus, string> = {
  intact:     STATUS_META.intact.color,
  weakening:  STATUS_META.weakening.color,
  broken:     STATUS_META.broken.color,
  unverified: STATUS_META.unverified.color,
};

// Conviction headline color: green strong, gold mid, red eroded.
export function convictionColor(intactFraction: number): string {
  return intactFraction >= 0.8 ? '#4ADE80' : intactFraction >= 0.5 ? '#E6B94D' : '#F87171';
}
