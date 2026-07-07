'use client';

// AgentSweep — the active half of the agent surface. "Run a full sweep" streams
// the real scans step by step (NDJSON from /api/agent/sweep) so the user watches
// the agent work — reading holdings, checking concentration, harvesting losses,
// cross-checking theses — instead of waiting on a spinner for one JSON blob.

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Check, Minus, ArrowRight } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const GOLD = '#E6B94D';
const GREEN = '#4ADE80';

type Status = 'running' | 'done' | 'skipped';
interface Step { id: string; label: string; status: Status; detail?: string; found?: number }
interface SweepResult { findings: number; headline: string }

interface StepEvent { type: 'step'; id: string; label?: string; status: Status; detail?: string; found?: number }
interface DoneEvent { type: 'done'; findings: number; headline: string }
interface ErrEvent { type: 'error'; message: string }
type SweepEvent = StepEvent | DoneEvent | ErrEvent;

export function AgentSweep() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runSweep() {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/agent/sweep', { signal: ctrl.signal });
      if (!res.ok || !res.body) { setError('Could not start the sweep.'); setRunning(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let ev: SweepEvent;
          try { ev = JSON.parse(trimmed) as SweepEvent; } catch { continue; }
          applyEvent(ev);
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('The sweep was interrupted.');
    } finally {
      setRunning(false);
    }
  }

  function applyEvent(ev: SweepEvent) {
    if (ev.type === 'step') {
      setSteps((prev) => {
        const i = prev.findIndex((s) => s.id === ev.id);
        if (i === -1) {
          return [...prev, { id: ev.id, label: ev.label ?? '', status: ev.status, detail: ev.detail, found: ev.found }];
        }
        const next = [...prev];
        next[i] = { ...next[i], status: ev.status, detail: ev.detail ?? next[i].detail, found: ev.found ?? next[i].found, label: ev.label ?? next[i].label };
        return next;
      });
    } else if (ev.type === 'done') {
      setResult({ findings: ev.findings, headline: ev.headline });
    } else if (ev.type === 'error') {
      setError(ev.message);
    }
  }

  const started = steps.length > 0 || result !== null || running;

  return (
    <section className="mb-3.5 overflow-hidden rounded-lg border border-white/[0.07] bg-[var(--color-bg-surface)]">
      {/* Header + trigger */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <span className="text-[13px]" style={{ color: GOLD }}>✦</span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
            Run a full sweep
          </div>
          {!started && (
            <p className="m-0 mt-0.5 text-[12.5px] leading-[1.45] text-[#7A7A7A]">
              Watch Helm work through your whole book in real time.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={runSweep}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-60"
          style={{ ...MONO, background: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {running ? 'Sweeping' : result ? 'Run again' : 'Sweep'}
        </button>
      </div>

      {/* Live steps */}
      {started && (
        <ol className="m-0 list-none border-t border-white/[0.05] p-0">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-3 border-b border-white/[0.03] px-5 py-2.5 last:border-0">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {s.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: GOLD }} />}
                {s.status === 'done' && <Check className="h-3.5 w-3.5" style={{ color: (s.found ?? 0) > 0 ? GOLD : GREEN }} />}
                {s.status === 'skipped' && <Minus className="h-3.5 w-3.5 text-[#5A5A5A]" />}
              </span>
              <span className={`shrink-0 text-[13.5px] leading-[1.4] ${s.status === 'skipped' ? 'text-[#6A6A6A]' : 'text-[#D8D8D8]'}`}>
                {s.label}
              </span>
              {s.detail && (
                <span
                  className="ml-auto truncate text-right font-mono text-[11px] tabular-nums"
                  style={{ ...MONO, color: (s.found ?? 0) > 0 ? GOLD : '#7A7A7A' }}
                >
                  {s.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Result */}
      {result && (
        <div
          className="flex items-center gap-2.5 border-t px-5 py-3"
          style={{
            borderColor: result.findings > 0 ? 'rgba(230,185,77,0.2)' : 'rgba(255,255,255,0.05)',
            background: result.findings > 0 ? 'rgba(230,185,77,0.05)' : 'transparent',
          }}
        >
          <span className="text-[12px]" style={{ color: result.findings > 0 ? GOLD : GREEN }}>✦</span>
          <span className="text-[13px] leading-[1.45] text-[#D4D4D4]">{result.headline}</span>
          {result.findings > 0 && (
            <a
              href="/dashboard/actions"
              className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)] no-underline hover:opacity-80"
              style={MONO}
            >
              Review <ArrowRight className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-white/[0.05] px-5 py-3 text-[13px] text-[var(--color-negative-text)]">{error}</div>
      )}
    </section>
  );
}
