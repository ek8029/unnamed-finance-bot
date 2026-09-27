// lib/digest-preview.ts
// The part of a morning digest a free account is shown: the first paragraph,
// cut at 200 characters. The morning email and /api/dashboard/brief both call
// this, so the preview in the inbox and the preview in the app cannot drift.

export const DIGEST_PREVIEW_CHARS = 200;

export function digestPreview(digest: string): string {
  return digest.split('\n\n')[0].slice(0, DIGEST_PREVIEW_CHARS);
}

/** The digest fields of the brief response. Pro reads the whole digest; a free
 *  account gets only the preview its morning email already carries. */
export function briefDigestFields(
  isPro: boolean,
  row: { digest: string | null; generated_at: string | null } | null | undefined,
): { digest: string | null; digestGeneratedAt: string | null; digestPreview: string | null } {
  if (isPro) {
    return { digest: row?.digest ?? null, digestGeneratedAt: row?.generated_at ?? null, digestPreview: null };
  }
  const preview = row?.digest ? digestPreview(row.digest) : '';
  return { digest: null, digestGeneratedAt: null, digestPreview: preview.trim() ? preview : null };
}
