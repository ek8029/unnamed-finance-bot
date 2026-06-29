/**
 * Citation scoreboard: the only honest measure of whether the visibility machine works.
 * Asks a web-search-enabled model the high-intent queries Helm wants to own, and records
 * whether helmterminal.dev / "Helm Terminal" shows up in the answer or its cited sources.
 *
 * This is a proxy for AEO/GEO reality (ChatGPT/Perplexity-style answer engines): if a model
 * that browses the live web won't surface Helm for "is NVDA still a buy", the machine isn't
 * yet self-sustaining no matter how clean the schema is.
 *
 * Usage: tsx scripts/probe-citation.ts
 * Optional: PROBE_MODEL=gpt-4o tsx scripts/probe-citation.ts
 *
 * Writes logs/citation-probe-<date>.json (machine) + prints a scannable table.
 * Run weekly. Track the "appeared" rate over time — that line going up is the machine working.
 */
import { config } from 'dotenv';
import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'node:fs';

config({ path: '.env.local' });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }
const openai = new OpenAI({ apiKey });

// web_search_preview needs a model that supports the tool. gpt-4o / gpt-4o-mini both do.
const MODEL = process.env.PROBE_MODEL ?? 'gpt-4o';

// The queries a real self-directed investor types into an answer engine. Two buckets:
// category (does Helm own "thesis monitoring") + long-tail intent (per-ticker hold/sell/bear).
const QUERIES: string[] = [
  // category land-grab
  'What tool tells me when my investment thesis breaks?',
  'best thesis monitoring tool for retail investors',
  'agentic portfolio terminal that tracks why I bought a stock',
  'how do I track my investment thesis against SEC filings',
  // long-tail per-ticker intent (the queries the /thesis pages target)
  'should I still hold NVDA in 2026',
  'what would break the Nvidia bull case',
  'is the Palantir thesis still intact',
  'when should I sell GameStop',
  // comparison / alternative
  'Helm Terminal vs Seeking Alpha for tracking a stock thesis',
];

const NEEDLES = ['helmterminal.dev', 'helm terminal', 'helmterminal'];

interface ProbeRow {
  query: string;
  appeared: boolean;
  inText: boolean;
  citedUrls: string[];
  helmUrls: string[];
  error?: string;
}

function extractCitations(resp: unknown): string[] {
  // Responses API: output[] -> message -> content[] -> annotations[] (url_citation).
  const urls: string[] = [];
  const out = (resp as { output?: unknown[] }).output ?? [];
  for (const item of out) {
    const content = (item as { content?: unknown[] }).content ?? [];
    for (const c of content) {
      const annotations = (c as { annotations?: unknown[] }).annotations ?? [];
      for (const a of annotations) {
        const url = (a as { url?: string }).url;
        if (url) urls.push(url);
      }
    }
  }
  return urls;
}

async function probe(query: string): Promise<ProbeRow> {
  try {
    const resp = await openai.responses.create({
      model: MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: query,
    });
    const text = (resp.output_text ?? '').toLowerCase();
    const citedUrls = extractCitations(resp);
    const helmUrls = citedUrls.filter((u) => NEEDLES.some((n) => u.toLowerCase().includes(n)));
    const inText = NEEDLES.some((n) => text.includes(n));
    return {
      query,
      appeared: inText || helmUrls.length > 0,
      inText,
      citedUrls,
      helmUrls,
    };
  } catch (err) {
    return {
      query, appeared: false, inText: false, citedUrls: [], helmUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  console.log(`\nCitation scoreboard  ${date}  (model: ${MODEL})\n`);

  const rows: ProbeRow[] = [];
  for (const q of QUERIES) {
    const row = await probe(q);
    rows.push(row);
    const mark = row.error ? 'ERR ' : row.appeared ? 'HIT ' : 'miss';
    const where = row.error ? row.error.slice(0, 40)
      : row.appeared ? (row.helmUrls[0] ? row.helmUrls[0] : 'in answer text') : '';
    console.log(`  [${mark}] ${q}`);
    if (where) console.log(`         ${where}`);
  }

  const hits = rows.filter((r) => r.appeared).length;
  const errs = rows.filter((r) => r.error).length;
  console.log(`\n  Appeared: ${hits}/${QUERIES.length}` + (errs ? `  (${errs} errored)` : ''));
  console.log('  Track this rate weekly. Up and to the right = the machine working.\n');

  mkdirSync('logs', { recursive: true });
  const outPath = `logs/citation-probe-${date}.json`;
  writeFileSync(outPath, JSON.stringify({ date, model: MODEL, hits, total: QUERIES.length, rows }, null, 2));
  console.log(`  Wrote ${outPath}\n`);
}

main();
