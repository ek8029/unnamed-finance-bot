'use client';

import { useState } from 'react';
import posthog from 'posthog-js';

/* Advisor research intake. Replaces the mailto CTAs: submitting here beats
   bouncing people to their mail app with a blank compose window. Styled as a
   panel in the page's chrome (mono header bar, hairline dividers). */

const inputClass =
  'w-full bg-[var(--color-bg-inset)] border border-[var(--color-border-strong)] rounded-[5px] px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none transition-colors duration-200 focus:border-[var(--color-gold)] min-h-[44px]';

const labelClass =
  'block font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--color-text-secondary)] mb-2';

export function IntakeForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'submitting') return;
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      firm: String(data.get('firm') ?? ''),
      note: String(data.get('note') ?? ''),
      website: String(data.get('website') ?? ''), // honeypot
    };

    setStatus('submitting');
    try {
      const res = await fetch('/api/advisors/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('idle');
        setError(json.error ?? 'Something went wrong. Try again.');
        return;
      }
      posthog.capture('advisor_intake_submitted', {
        has_firm: payload.firm.trim().length > 0,
        has_note: payload.note.trim().length > 0,
      });
      setStatus('success');
    } catch {
      setStatus('idle');
      setError('Something went wrong. Try again.');
    }
  }

  return (
    <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border-base)] font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
        <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-gold)] shadow-[0_0_10px_var(--color-gold)]" />
        The interview starts here
        <span className="ml-auto text-[var(--color-text-secondary)]">20 min · no pitch</span>
      </div>

      {status === 'success' ? (
        <div className="p-8 max-sm:p-5" role="status">
          <p className="font-mono text-[12px] tracking-[0.14em] uppercase text-[var(--color-positive)] mb-3">
            Received
          </p>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-primary)] max-w-[480px]">
            The founder reads every one of these. You&rsquo;ll hear back within a day, with two or
            three times that work for a call.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative p-8 max-sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label htmlFor="intake-name" className={labelClass}>
                Name
              </label>
              <input
                id="intake-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="intake-email" className={labelClass}>
                Work email
              </label>
              <input
                id="intake-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@yourfirm.com"
                className={inputClass}
              />
            </div>
          </div>
          <div className="mb-5">
            <label htmlFor="intake-firm" className={labelClass}>
              Firm &amp; role <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="intake-firm"
              name="firm"
              type="text"
              placeholder="Solo RIA, founder · ~120 households"
              className={inputClass}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="intake-note" className={labelClass}>
              What can&rsquo;t you see? <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="intake-note"
              name="note"
              rows={3}
              placeholder="One sentence on the blind spot that bites. We'll ask about the rest on the call."
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Honeypot: hidden from people, filled by bots. */}
          <div className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" aria-hidden>
            <label htmlFor="intake-website">Website</label>
            <input id="intake-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {error && (
            <p className="text-[14px] text-[var(--color-negative-text)] mb-4" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex items-center font-mono text-[13px] font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-default"
            >
              {status === 'submitting' ? 'Sending…' : 'Walk us through your morning →'}
            </button>
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              Read by the founder, not a funnel.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
