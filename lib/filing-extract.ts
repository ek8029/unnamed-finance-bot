// HTML-to-text + section extraction for SEC filings (10-K/10-Q/8-K).
//
// Two problems this solves, both of which previously caused filings to contribute
// ~zero thesis evidence:
//
// 1. Entity pollution. SEC inline-XBRL filings glue numbers together with numeric
//    non-breaking spaces ("108&#160;million", "$20.2&#160;billion") and use numeric
//    entities for punctuation ("Company&#8217;s"). A generic tag-strip that only
//    decodes a handful of named entities leaves these as literal "&#160;" text, so
//    an LLM's clean quote ("108 million shares") is never a verbatim substring of
//    the source and gets dropped by the no-fabrication guard. stripFilingHtml
//    decodes ALL entities BEFORE collapsing whitespace.
//
// 2. Wrong section. The first 8000 chars of a 10-K/10-Q are the cover page, table
//    of contents, and a "Forward-Looking Statements" disclaimer, none of which bears
//    on a thesis. The substance is the MD&A "Results of Operations" section.
//    extractFilingSection lands on that section's content heading.

export function stripFilingHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    // Drop financial tables: stripped to text they are column-of-numbers soup
    // ("Gross profit 74.9 60.5") that no LLM can quote as a verbatim sentence.
    // The MD&A narrative that discusses them ("Revenue increased ... driven by ...")
    // lives in paragraphs and survives, which is the quotable thesis evidence.
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Decode entities BEFORE collapsing whitespace, so a numeric nbsp (&#160;)
    // becomes a real space and "108&#160;million" reads as "108 million".
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:rsquo|lsquo|apos);/gi, "'")
    .replace(/&(?:rdquo|ldquo);/gi, '"')
    .replace(/&(?:mdash|ndash);/gi, '-')
    .replace(/&[a-z]+;/gi, ' ') // drop any remaining named entities
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFilingSection(stripped: string, form: string, maxLen = 8000): string {
  if (stripped.length <= maxLen) return stripped;

  if (/10-?[KQ]/i.test(form)) {
    // The MD&A "Results of (Continuing) Operations" content heading is title-cased.
    // Mid-sentence mentions ("results of operations or reputation") are lowercase;
    // the table-of-contents entry is followed by a page number ("Results of
    // Operations 23"); and the section header tail is "...Results of Operations
    // Forward-Looking". Requiring a following capital letter that is not "Forward"
    // isolates the real content section.
    const m = stripped.match(/Results of (?:Continuing )?Operations (?!Forward)[A-Z]/);
    if (m && m.index !== undefined) return stripped.slice(m.index, m.index + maxLen);

    // Fallbacks: the MD&A header, then risk factors, then a post-cover window.
    const lower = stripped.toLowerCase();
    const dna = lower.lastIndexOf('discussion and analysis');
    if (dna >= 0) return stripped.slice(dna, dna + maxLen);
    const rf = lower.lastIndexOf('risk factors');
    if (rf >= 0) return stripped.slice(rf, rf + maxLen);
  }

  // 8-K and fallback: skip the cover/registrant boilerplate, take a body window.
  const start = Math.min(1600, Math.max(0, stripped.length - maxLen));
  return stripped.slice(start, start + maxLen);
}
