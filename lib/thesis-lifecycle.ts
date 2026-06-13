// Pillar lifecycle: the accept/dismiss training signal (v2 learning layer input).
export type Lifecycle = 'proposed' | 'confirmed' | 'edited' | 'dismissed';

export const LIFECYCLES: readonly Lifecycle[] = ['proposed', 'confirmed', 'edited', 'dismissed'];

/**
 * Returns the new lifecycle a PATCH should set, or null when no transition applies.
 * Only `proposed` drafts transition via PATCH: confirm as-is -> 'confirmed',
 * confirm with a reworded claim -> 'edited'. Dismissal happens via DELETE.
 */
export function nextLifecycle(
  current: Lifecycle,
  patch: { confirmed?: boolean; claimChanged?: boolean },
): Lifecycle | null {
  if (current !== 'proposed') return null;
  if (patch.confirmed !== true) return null;
  return patch.claimChanged ? 'edited' : 'confirmed';
}
