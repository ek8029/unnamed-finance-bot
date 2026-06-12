// lib/thesis-evidence.ts
// Verbatim-excerpt verification. Spec §4.3 step 2: rows whose excerpt
// is not found in the source are dropped. Applies to filing/form4/news only.

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function excerptFoundInSource(excerpt: string, sourceText: string): boolean {
  const e = normalize(excerpt);
  if (e.length === 0) return false;
  return normalize(sourceText).includes(e);
}

export const TEXT_SOURCES = new Set(['filing', 'form4', 'news']);
