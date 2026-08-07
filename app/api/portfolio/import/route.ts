/**
 * POST /api/portfolio/import
 *
 * Turn a brokerage CSV export or a holdings screenshot into candidate rows.
 * READ-ONLY: this route never touches the database. It returns rows the client
 * then shows in the manual-entry form for the user to correct, and
 * POST /api/portfolio/manual remains the only write path.
 *
 * The image is processed in memory and discarded. Holdings screenshots carry
 * account numbers, balances and names, so nothing here persists the bytes,
 * logs them, or hands them to storage.
 *
 * Body: { csv: string } | { imageDataUrl: string }
 * Returns: { rows: ImportedRow[], skipped: ImportSkip[], source: 'csv'|'image' }
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import {
  parseHoldingsCsv,
  mergeLots,
  toRow,
  IMPORT_MAX_ROWS,
  type ImportedRow,
  type ImportSkip,
} from '@/lib/portfolio-import';

export const maxDuration = 60;

const VISION_MODEL = 'gpt-4o';

/** Bounds the vision spend per account. Signed-in only, so per-user is enough. */
const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const limiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(12, '1 h'),
      analytics: true,
      prefix: 'helm:rl:portfolio-import',
    })
  : null;

/** ~8MB of base64 is a generous phone screenshot and a hard ceiling on cost. */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_CSV_CHARS = 400_000;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

const PROMPT = `You are reading a screenshot of a brokerage account's holdings.

Return ONLY a JSON object of the form:
{"rows":[{"ticker":"AAPL","shares":"10","unitCost":"150.00","totalCost":null}]}

Rules:
- One entry per position visible in the image.
- "ticker" is the exchange symbol. If only a company name is shown and you are
  not certain of its symbol, omit that row rather than guessing.
- "shares" is the quantity held.
- "unitCost" is cost PER SHARE (labelled average cost, cost/share, price paid).
- "totalCost" is the TOTAL cost of the position (labelled cost basis, total cost).
- Put each value in the field that matches ITS OWN label. Never move a total
  into unitCost or a unit price into totalCost, and never divide or multiply.
- Use null for anything not visible. Do not infer, estimate, or fill gaps.
- Copy digits exactly as shown. Do not round.
- Market value and current price are NOT cost. Leave both cost fields null if
  the screenshot only shows what a position is worth today.`;

interface VisionRow {
  ticker?: unknown;
  shares?: unknown;
  unitCost?: unknown;
  totalCost?: unknown;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;

async function extractFromImage(dataUrl: string): Promise<{ rows: ImportedRow[]; skipped: ImportSkip[] }> {
  const res = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    // Deterministic: the same screenshot must not produce different numbers.
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) return { rows: [], skipped: [] };

  let parsed: { rows?: VisionRow[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { rows: [], skipped: [{ raw: 'model output', reason: 'could not read the response' }] };
  }

  const rows: ImportedRow[] = [];
  const skipped: ImportSkip[] = [];
  for (const r of (parsed.rows ?? []).slice(0, IMPORT_MAX_ROWS)) {
    // Every extracted value goes through the SAME normaliser the CSV path uses,
    // so a model that returns "1,500" or "$150" cannot smuggle a bad number in.
    const out = toRow(str(r.ticker) ?? '', str(r.shares) ?? '', str(r.unitCost), str(r.totalCost));
    if ('reason' in out) skipped.push(out);
    else rows.push(out);
  }
  return { rows, skipped };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { csv?: unknown; imageDataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const csv = typeof body.csv === 'string' ? body.csv : null;
  const image = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : null;

  if (csv) {
    if (csv.length > MAX_CSV_CHARS) {
      return NextResponse.json({ error: 'That file is too large. Export just the holdings table.' }, { status: 413 });
    }
    const { rows, skipped } = parseHoldingsCsv(csv);
    if (rows.length === 0 && skipped.length === 0) {
      return NextResponse.json(
        { error: 'No holdings found. The file needs a symbol column and a quantity column.' },
        { status: 422 },
      );
    }
    return NextResponse.json({ rows: mergeLots(rows), skipped, source: 'csv' });
  }

  if (!image) {
    return NextResponse.json({ error: 'Send a CSV or an image' }, { status: 400 });
  }
  if (!/^data:image\/(png|jpe?g|webp|heic);base64,/i.test(image)) {
    return NextResponse.json({ error: 'That is not an image Helm can read' }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: 'That image is too large. A normal screenshot is fine.' }, { status: 413 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Image import is unavailable right now' }, { status: 503 });
  }

  if (limiter) {
    try {
      const { success } = await limiter.limit(user.id);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many imports in the last hour. Try again later, or paste a CSV.' },
          { status: 429 },
        );
      }
    } catch (e) {
      // Fail open on a Redis blip, same as the analyze limiter.
      console.error('[portfolio-import] rate-limit check failed (allowing):', e);
    }
  }

  try {
    const { rows, skipped } = await extractFromImage(image);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No positions found in that image. Try the screen that lists your holdings.', skipped },
        { status: 422 },
      );
    }
    return NextResponse.json({ rows: mergeLots(rows), skipped, source: 'image' });
  } catch (e) {
    // Never echo the error: it can carry request payload, and the payload is a
    // picture of somebody's brokerage account.
    console.error('[portfolio-import] extraction failed');
    if (e instanceof Error) console.error('[portfolio-import]', e.name);
    return NextResponse.json({ error: 'Could not read that image. Try again or paste a CSV.' }, { status: 500 });
  }
}
