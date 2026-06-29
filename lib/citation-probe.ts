import OpenAI from 'openai';

// The AEO/GEO scoreboard core, shared by the weekly cron and the manual script.
// Asks a web-search model the queries Helm wants to own and records whether
// helmterminal.dev surfaces in the answer or its cited sources. A proxy for what
// ChatGPT/Perplexity-style engines would say. The hit rate trending up over time
// is the only honest signal the visibility machine is working.

// The queries a real self-directed investor types into an answer engine: category
// land-grab + long-tail per-ticker intent (the queries the /thesis pages target).
export const PROBE_QUERIES: string[] = [
  'What tool tells me when my investment thesis breaks?',
  'best thesis monitoring tool for retail investors',
  'agentic portfolio terminal that tracks why I bought a stock',
  'how do I track my investment thesis against SEC filings',
  'should I still hold NVDA in 2026',
  'what would break the Nvidia bull case',
  'is the Palantir thesis still intact',
  'when should I sell GameStop',
  'Helm Terminal vs Seeking Alpha for tracking a stock thesis',
];

const NEEDLES = ['helmterminal.dev', 'helm terminal', 'helmterminal'];

export interface ProbeRow {
  query: string;
  appeared: boolean;
  inText: boolean;
  citedUrls: string[];
  helmUrls: string[];
  error?: string;
}

export interface ProbeResult {
  date: string;
  model: string;
  hits: number;
  total: number;
  rows: ProbeRow[];
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

async function probeOne(openai: OpenAI, model: string, query: string): Promise<ProbeRow> {
  try {
    const resp = await openai.responses.create({
      model,
      tools: [{ type: 'web_search_preview' }],
      input: query,
    });
    const text = (resp.output_text ?? '').toLowerCase();
    const citedUrls = extractCitations(resp);
    const helmUrls = citedUrls.filter((u) => NEEDLES.some((n) => u.toLowerCase().includes(n)));
    const inText = NEEDLES.some((n) => text.includes(n));
    return { query, appeared: inText || helmUrls.length > 0, inText, citedUrls, helmUrls };
  } catch (err) {
    return {
      query, appeared: false, inText: false, citedUrls: [], helmUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the full probe. Pass a `date` (the runtime forbids implicit Date in some
 * contexts; the caller supplies it). Throws only if OPENAI_API_KEY is missing;
 * per-query failures are captured as row.error so one bad query never sinks the run.
 */
export async function runCitationProbe(opts: { date: string; model?: string }): Promise<ProbeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const openai = new OpenAI({ apiKey });
  const model = opts.model ?? process.env.PROBE_MODEL ?? 'gpt-4o';
  const rows: ProbeRow[] = [];
  for (const q of PROBE_QUERIES) rows.push(await probeOne(openai, model, q));
  const hits = rows.filter((r) => r.appeared).length;
  return { date: opts.date, model, hits, total: PROBE_QUERIES.length, rows };
}
