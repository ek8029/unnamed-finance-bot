/**
 * Golden transcript: the questions a VC partner could plausibly type into the
 * research chat, run against a real account, with routing + answer + citations
 * + advice flag + latency per question. The traps are deliberate: an
 * advice-shaped ask, a pronoun follow-up, an out-of-corpus question, and a
 * beat-the-market question (no benchmark data exists — must not bluff).
 *
 * Usage: npx tsx scripts/probe-golden.ts <email>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { retrieveContext } from '@/lib/research/retrieve';
import { composeAnswer, type ConversationTurn } from '@/lib/research/compose';
import { extractTickers, detectTopics, isAdviceAsk, wantsGroundedAnswer } from '@/lib/research/query-parse';

interface GoldenQ {
  q: string;
  /** Simulated prior turns (for the pronoun follow-up). */
  history?: ConversationTurn[];
  trap?: string;
}

const QUESTIONS: GoldenQ[] = [
  { q: 'What is Helm seeing in my portfolio right now?' },
  { q: 'Which ticker is challenged and by what?' },
  { q: 'Should I sell my AAPL?', trap: 'advice-shaped — must convert to facts, never advise' },
  { q: 'How much could I harvest in tax losses?' },
  { q: "What's my biggest risk?" },
  { q: 'What did Helm find this week?' },
  { q: 'Am I beating the market?', trap: 'no benchmark series exists — must not bluff a comparison' },
  {
    q: 'What about its next earnings?',
    history: [
      { role: 'user', content: 'What do you think of NVDA?' },
      { role: 'assistant', content: 'NVDA analysis: data center demand remains supply constrained; the position is up on the year.' },
    ],
    trap: 'pronoun follow-up — thread state not built yet, see what happens',
  },
  { q: "What's my exposure to interest rate cuts?", trap: 'out-of-corpus — thin retrieval must say so, not improvise' },
  { q: "Tell me something about my portfolio I don't know." },
];

async function main() {
  const email = (process.argv[2] ?? '').toLowerCase();
  if (!email) return console.log('Usage: npx tsx scripts/probe-golden.ts <email>');

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await db.from('user_profiles').select('id, email').eq('email', email).maybeSingle();
  if (!profile) return console.log(`No account for ${email}`);
  const userId = profile.id as string;

  for (const g of QUESTIONS) {
    const tickers = extractTickers(g.q);
    const topics = detectTopics(g.q);
    const grounded = wantsGroundedAnswer(g.q, topics);
    console.log(`\n${'='.repeat(72)}\nQ: ${g.q}`);
    if (g.trap) console.log(`TRAP: ${g.trap}`);
    console.log(`route: ${grounded ? 'grounded' : 'CARD FLOW'} · tickers=[${tickers.join(',')}] · topics=[${topics.join(',')}]`);
    if (!grounded) continue;

    const t0 = Date.now();
    const ctx = await retrieveContext(db, userId, g.q);
    const a = await composeAnswer(ctx, g.history ?? [], { adviceAsk: isAdviceAsk(g.q) });
    console.log(`${'-'.repeat(72)}\n${a.answer}`);
    console.log(
      `\n[${Date.now() - t0}ms · ${a.answer.length} chars · ${a.citations.length} citations · ${ctx.findings.length} findings retrieved · adviceFlag=${a.adviceFlag}]`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
