// Holding-level "on balance" verdict chip + optional sentence (spec F3).
// Pure render over lib/thesis-verdict; reuses the existing status palette.

import { VERDICT_META, type ThesisVerdict } from '@/lib/thesis-verdict';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export function VerdictChip({ verdict }: { verdict: ThesisVerdict }) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border"
      style={{ ...MONO, borderColor: `${meta.color}4D`, background: `${meta.color}14` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

export function VerdictLine({ verdict, sentence }: { verdict: ThesisVerdict; sentence: string }) {
  return (
    <div className="flex items-start gap-2.5 flex-wrap">
      <VerdictChip verdict={verdict} />
      <p className="m-0 text-[14px] leading-[1.5] text-[#9A9A9A] flex-1 min-w-[200px]">{sentence}</p>
    </div>
  );
}
