// Ask a model to group a pillar's evidence into causal mechanisms.
//
// Why a model, and why per pillar rather than per row: clustering is a SET-level
// question ("are these four stories the same causal story?"). The scoring judge
// sees one source at a time, so it cannot answer it, which is why entity overlap
// was standing in. Entity overlap works on names with distinct external actors
// and fails on financials, where JPM kept a 64-finding blob at every tuning.
//
// One call per pillar per run. At ~80 pillars that is trivial, and house-scoping
// amortises a single scan across every holder of the ticker.
//
// Nothing here writes to the database. It feeds /testing/thesis-v2/mechanisms,
// where its grouping is shown beside the regex grouping so the difference can be
// judged rather than asserted.

import OpenAI from 'openai';
import { fence, INJECTION_GUARD, clampText } from '@/lib/prompt-safety';
import { ceilingForMembers, type ClusterItem, type Mechanism } from './mechanism-cluster';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

export const MECHANISM_MODEL = 'gpt-4o';

/** Excerpts are long and repetitive; the mechanism is legible well before this. */
const PER_FINDING_CHARS = 320;
/** Above this a single pillar's evidence stops fitting a sensible prompt. */
export const MAX_FINDINGS_PER_CALL = 120;

export interface JudgeableFinding {
  id: string;
  title: string;
  excerpt: string;
  dateISO: string;
}

export interface JudgedMechanism {
  label: string;
  /** Why these belong together, in the model's words. Shown on screen. */
  rationale: string;
  memberIds: string[];
}

interface RawGroup {
  label?: unknown;
  rationale?: unknown;
  members?: unknown;
}

const SYSTEM = `${INJECTION_GUARD}
You group evidence about one investment thesis pillar into MECHANISMS.

A mechanism is the causal story, not the headline and not the topic. "Rival
silicon substitution" is a mechanism. "Nvidia" is not, and neither is "news
about the company".

Rules:
- Two findings belong to the same mechanism when the same underlying cause would
  explain both. Five outlets covering one event is one mechanism. Two separate
  contract losses to two different governments are TWO mechanisms, even though
  both are about losing contracts, because each has its own cause and either
  could resolve without the other.
- Never group findings merely because they name the same company, product or
  sector. That is the subject, not a mechanism.
- A finding that shares no cause with any other is its own mechanism of one.
  That is a normal and correct outcome, not a failure.
- Label each mechanism as a short causal phrase, at most six words, naming the
  driver rather than the ticker. Prefer "Government contract losses in Europe"
  over "Palantir news".
- rationale: one sentence on what the shared cause actually is.
- Every finding id given to you must appear in exactly one group. Never invent
  an id and never repeat one.

Respond with JSON exactly in this shape:
{ "mechanisms": [ { "label": "...", "rationale": "...", "members": ["<id>", "<id>"] } ] }`;

/**
 * Group one pillar's findings. Returns [] when the model is unavailable or its
 * answer fails validation, so the caller can fall back rather than show a
 * grouping nobody checked.
 */
export async function judgeMechanisms(
  pillarClaim: string,
  breaksIf: string | null,
  findings: JudgeableFinding[],
  model: string = MECHANISM_MODEL,
): Promise<JudgedMechanism[]> {
  if (findings.length === 0) return [];
  if (findings.length === 1) {
    return [{ label: findings[0].title.slice(0, 60), rationale: 'Only one finding on this pillar.', memberIds: [findings[0].id] }];
  }
  const batch = findings.slice(0, MAX_FINDINGS_PER_CALL);

  // Short opaque ids keep the model from pattern-matching on uuid fragments and
  // keep the prompt small. Mapped back before returning.
  const shortToReal = new Map<string, string>();
  const lines = batch.map((f, i) => {
    const short = `f${i + 1}`;
    shortToReal.set(short, f.id);
    return `${short} [${f.dateISO}] ${clampText(`${f.title}. ${f.excerpt}`, PER_FINDING_CHARS)}`;
  });

  const userPrompt =
    `Pillar: ${fence(pillarClaim, 'PILLAR')}\n` +
    (breaksIf ? `Breaks if: ${fence(breaksIf, 'BREAKS_IF')}\n` : '') +
    `\nFindings:\n${fence(lines.join('\n'), 'FINDINGS')}`;

  let parsed: { mechanisms?: RawGroup[] };
  try {
    const res = await getOpenAI().chat.completions.create({
      model,
      // Grouping should not wander between runs on identical input.
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
    parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}');
  } catch {
    return [];
  }

  const groups = Array.isArray(parsed.mechanisms) ? parsed.mechanisms : [];
  const seen = new Set<string>();
  const out: JudgedMechanism[] = [];

  for (const g of groups) {
    const members = Array.isArray(g.members) ? g.members : [];
    const realIds: string[] = [];
    for (const m of members) {
      const real = shortToReal.get(String(m));
      // Drop unknown ids rather than trusting them, and never let a finding
      // land in two mechanisms: double-counting is the exact bug the ladder exists to stop.
      if (!real || seen.has(real)) continue;
      seen.add(real);
      realIds.push(real);
    }
    if (realIds.length === 0) continue;
    out.push({
      label: String(g.label ?? '').trim().slice(0, 80) || 'Unlabelled',
      rationale: String(g.rationale ?? '').trim().slice(0, 240),
      memberIds: realIds,
    });
  }

  // Anything the model forgot stays visible as its own mechanism. Silently
  // dropping evidence would be worse than an ugly grouping.
  for (const f of batch) {
    if (!seen.has(f.id)) {
      out.push({ label: f.title.slice(0, 60), rationale: 'Not grouped by the model; kept on its own.', memberIds: [f.id] });
    }
  }
  return out;
}

/**
 * Put judged groups through the same corroboration ladder the entity-overlap
 * grouping uses, so the two can be compared on equal terms. Only the grouping
 * changes; every rule about what escalates a pillar stays where it is.
 */
export function toMechanisms<T extends ClusterItem & { severe?: boolean }>(
  judged: JudgedMechanism[],
  items: T[],
): Mechanism<T>[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Mechanism<T>[] = [];

  for (const g of judged) {
    const members = g.memberIds
      .map((id) => byId.get(id))
      .filter((m): m is T => !!m)
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    if (members.length === 0) continue;

    const distinct = [...new Set(members.map((m) => m.sourceClass))];
    const { maxStatus, reason } = ceilingForMembers(members);
    const dates = members.map((m) => m.dateISO).filter(Boolean).sort();

    out.push({
      label: g.label,
      items: members,
      sourceClasses: distinct,
      confirmations: distinct.length,
      mentions: members.length,
      firstSeen: dates[0] ?? '',
      lastSeen: dates[dates.length - 1] ?? '',
      maxStatus,
      ladderReason: reason,
    });
  }

  const rank = { broken: 2, weakening: 1, watch: 0 } as const;
  return out.sort(
    (a, b) =>
      rank[b.maxStatus] - rank[a.maxStatus] ||
      b.confirmations - a.confirmations ||
      b.mentions - a.mentions ||
      b.lastSeen.localeCompare(a.lastSeen),
  );
}
