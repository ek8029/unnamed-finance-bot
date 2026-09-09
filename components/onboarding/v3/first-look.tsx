'use client';
import { useRef, useState } from 'react';
import { FIRST_LOOK_CODES, type FirstLook } from '@/lib/onboarding/first-look';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

export function FirstLookQuestion({ accounts, onDone }: { accounts: number; onDone: (codes: FirstLook[]) => void }) {
  const [picked, setPicked] = useState<FirstLook[]>([]);
  const done = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const options = FIRST_LOOK_CODES.filter((c) => c !== 'overlap' || accounts >= 2);
  const toggle = (c: FirstLook) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  function save(codes: FirstLook[]) {
    if (done.current) return;
    done.current = true;
    setSubmitted(true);
    // Non-blocking: a failed save (migration not applied, network) never holds the reveal.
    fetch('/api/user/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_look: codes }) }).catch((e) => console.error('first_look save failed', e));
    onDone(codes);
  }
  return (
    <fieldset className="mt-6 max-w-md">
      <legend className="text-[15px] text-[var(--color-text-primary)]">{V3_COPY.firstLook.heading}</legend>
      <div className="mt-3 grid gap-2">
        {options.map((c) => (
          <label key={c} className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-[var(--color-border-base)] cursor-pointer has-[:checked]:border-[var(--color-gold)]">
            <input type="checkbox" className="h-4 w-4" checked={picked.includes(c)} onChange={() => toggle(c)} disabled={submitted} />
            <span className="text-[14px]">{V3_COPY.firstLook.options[c]}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button type="button" className="helm-button min-h-[44px]" onClick={() => save(picked)} disabled={submitted}>{V3_COPY.firstLook.save}</button>
        <button type="button" className="min-h-[44px] text-[13px] text-[var(--color-text-muted)] underline-offset-2 hover:underline" onClick={() => save([])} disabled={submitted}>{V3_COPY.firstLook.skip}</button>
      </div>
    </fieldset>
  );
}
