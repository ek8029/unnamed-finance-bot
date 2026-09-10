'use client';

// The overview's agent log. This slot used to be titled "Helm Brief" and
// rendered the actions inbox feed rather than the brief, so it promised one
// thing and showed another while the inbox already had its own card below.
// The log is the only thing on the page that evidences work: every line is a
// real timestamped row written by the crons, read through /api/agent/worklog.
//
// Free accounts see their own log too, because the crons run on every book.
// What Pro adds is the thesis work, which is what the CTA names.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { WorklogResponse, WorklogStep } from '@/lib/agent/worklog';
import { AGENT_LOG_COPY, AGENT_LOG_LINES, cadenceLabel, clockET, topSteps } from '@/lib/agent/worklog-display';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const GOLD_BORDER = 'color-mix(in srgb, var(--color-gold) 18%, transparent)';
const GOLD_WASH = 'color-mix(in srgb, var(--color-gold) 2.5%, transparent)';
const GOLD_RULE = 'color-mix(in srgb, var(--color-gold) 12%, transparent)';
const GOLD_BUTTON = 'color-mix(in srgb, var(--color-gold) 8%, transparent)';

// A quiet arrival, staggered per line, so the log reads as it lands instead of
// flashing in as a block. Reduced motion switches it off entirely.
const ARRIVE_CSS = `
@keyframes helm-log-arrive { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }
.helm-log-line { animation: helm-log-arrive 300ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .helm-log-line { animation: none; } }
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-full flex-col rounded-lg px-[22px] py-5"
      style={{ border: `1px solid ${GOLD_BORDER}`, background: GOLD_WASH, boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </div>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <Sparkles size={15} strokeWidth={1.6} className="text-[var(--color-gold)]" />
      <span className="text-[12px] uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: GOLD_RULE }} />
    </div>
  );
}

function Line({ step, index }: { step: WorklogStep; index: number }) {
  const at = clockET(step.ts);
  return (
    <li
      className="helm-log-line grid grid-cols-[58px_minmax(0,1fr)] items-baseline gap-x-3 py-[7px]"
      style={{ animationDelay: `${60 + index * 70}ms` }}
    >
      <span className="text-[10.5px] tabular-nums text-[var(--color-text-muted)]" style={MONO}>
        {at}
      </span>
      <span className="min-w-0">
        <span
          className={`text-[14px] leading-[1.5] ${
            step.emphasis ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-secondary)]'
          }`}
        >
          {step.label}
        </span>
        {step.cadence && (
          <span
            className="ml-2 whitespace-nowrap text-[9.5px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
            style={MONO}
          >
            {cadenceLabel(step.cadence)}
          </span>
        )}
      </span>
    </li>
  );
}

function GhostLines() {
  return (
    <ul className="m-0 mb-4 flex-1 list-none p-0" aria-label="Loading the work log">
      {Array.from({ length: AGENT_LOG_LINES }, (_, i) => (
        <li key={i} className="grid grid-cols-[58px_minmax(0,1fr)] items-baseline gap-x-3 py-[7px]">
          <span className="block h-3 w-10 rounded bg-white/[0.05]" />
          <span className="block h-3 rounded bg-white/[0.05]" style={{ width: `${86 - i * 9}%` }} />
        </li>
      ))}
    </ul>
  );
}

export function AgentLogCard({ isPro, isDemo }: { isPro: boolean; isDemo?: boolean }) {
  const [log, setLog] = useState<WorklogResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    fetch('/api/agent/worklog')
      .then((r) => (r.ok ? (r.json() as Promise<WorklogResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (active) setLog(j); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [isDemo]);

  const footer = isPro ? (
    <Link
      href="/dashboard/brief"
      className="mt-auto flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
      style={{ ...MONO, border: `1px solid ${GOLD_BORDER}`, background: GOLD_BUTTON }}
    >
      {AGENT_LOG_COPY.brief} <span>→</span>
    </Link>
  ) : (
    <div className="mt-auto">
      <p className="m-0 mb-2 text-[11.5px] leading-[1.5] text-[var(--color-text-muted)]">{AGENT_LOG_COPY.unlockWhy}</p>
      <Link
        href="/pricing"
        className="flex items-center justify-between rounded-[5px] px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]"
        style={{ ...MONO, border: `1px solid ${GOLD_BORDER}`, background: GOLD_BUTTON }}
      >
        {AGENT_LOG_COPY.unlock} <span>→</span>
      </Link>
    </div>
  );

  if (isDemo) {
    return (
      <Shell>
        <Header label={AGENT_LOG_COPY.demoEyebrow} />
        <p className="m-0 mb-4 flex-1 text-[15px] leading-[1.62] text-[var(--color-text-secondary)]">
          {AGENT_LOG_COPY.demo}
        </p>
        {footer}
      </Shell>
    );
  }

  const steps = log ? topSteps(log.steps) : [];

  return (
    <Shell>
      <style>{ARRIVE_CSS}</style>
      <Header label={AGENT_LOG_COPY.eyebrow} />
      {!log && !failed ? (
        <GhostLines />
      ) : failed ? (
        <p className="m-0 mb-4 flex-1 text-[15px] leading-[1.62] text-[var(--color-text-muted)]">
          <span role="status">{AGENT_LOG_COPY.unavailable}</span>
        </p>
      ) : steps.length === 0 ? (
        <p className="m-0 mb-4 flex-1 text-[15px] leading-[1.62] text-[var(--color-text-muted)]">
          {AGENT_LOG_COPY.empty}
        </p>
      ) : (
        <ul className="m-0 mb-4 flex-1 list-none p-0" aria-label="Updates">
          {steps.map((s, i) => (
            <Line key={s.id} step={s} index={i} />
          ))}
        </ul>
      )}
      {footer}
    </Shell>
  );
}
