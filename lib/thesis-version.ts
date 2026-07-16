// lib/thesis-version.ts
// F4 (spec 2026-07-15): thesis version provenance. A version bump means the USER
// materially edited the thesis (pillar claim text changed, pillar added or removed).
// Agent-driven evidence/status flow never bumps. Read-modify-write is acceptable
// here: thesis edits are single-user actions, not concurrent.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/** Pure predicate: does a pillar PATCH body constitute a material edit? */
export function isMaterialPillarPatch(body: Record<string, unknown>, claimChanged: boolean): boolean {
  // Only an actual claim-text change is material. Confirming a draft, reordering,
  // or overriding status is bookkeeping, not a change to the thesis itself.
  return 'claim' in body && claimChanged;
}

/** Bump theses.version and stamp version_updated_at. Never throws — provenance must not block the edit itself. */
export async function bumpThesisVersion(db: AnyClient, thesisId: string): Promise<void> {
  try {
    const { data: row } = await db.from('theses').select('version').eq('id', thesisId).maybeSingle();
    const current = (row?.version as number | undefined) ?? 1;
    const { error } = await db
      .from('theses')
      .update({ version: current + 1, version_updated_at: new Date().toISOString() })
      .eq('id', thesisId);
    if (error) console.error('[thesis-version] bump failed:', error.message);
  } catch (err) {
    console.error('[thesis-version] bump error:', err);
  }
}
