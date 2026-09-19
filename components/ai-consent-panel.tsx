'use client';

import { useEffect, useState } from 'react';
import { AI_CONSENT_VERSION, type AiConsent } from '@/lib/ai-consent';

export function AiConsentPanel({ compact = false }: { compact?: boolean }) {
  const [consent, setConsent] = useState<AiConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/user/ai-consent', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!result.ok) throw new Error('Could not read your AI permission.');
      setConsent(await result.json()); setError(null);
    } catch { setError('Could not read your AI permission. Try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    const reload = () => { void load(); };
    window.addEventListener('helm:ai-consent', reload);
    return () => window.removeEventListener('helm:ai-consent', reload);
  }, []);
  const choose = async (granted: boolean) => {
    setBusy(true); setError(null);
    try {
      const result = await fetch('/api/user/ai-consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ granted, version: AI_CONSENT_VERSION }),
      });
      const next = await result.json();
      if (!result.ok) throw new Error(next.error || 'Could not save your choice.');
      setConsent(next);
      window.dispatchEvent(new Event('helm:ai-consent'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your choice.'); }
    finally { setBusy(false); }
  };
  if (compact && (loading || consent?.granted || consent?.revokedAt)) return null;
  return (
    <section aria-label="Personal AI processing" style={{ border: '1px solid var(--color-border-base)', background: 'var(--color-bg-surface)', padding: 20, borderRadius: 12, marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>Personal AI processing</h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
        With your permission, Helm sends relevant holdings, balances, gains and losses, tax context,
        thesis reasons and questions to OpenAI and Anthropic to write your brief, answer questions,
        and monitor your reasons against filings. Bank passwords and payment card details are not sent.
        These providers process requests under their API privacy policies and do not use this API data
        for model training by default. They may retain inputs for safety and abuse prevention.
        Screenshot imports ask separately before sending an image to OpenAI, which may retain it for up to 30 days for abuse monitoring, with safety or legal exceptions.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
        You can pause future personal AI processing here at any time. Processing already started may finish;
        your portfolio, arithmetic, saved results and subscription remain available. Pausing does not cancel a subscription.
        {' '}<a href="/privacy" style={{ textDecoration: 'underline' }}>Read the privacy policy</a>.
        {compact && <> Manage this choice in <a href="/dashboard/settings" style={{ textDecoration: 'underline' }}>Settings &gt; Data &amp; privacy</a>.</>}
      </p>
      {!compact && <p role="status" style={{ marginTop: 12 }}>{loading ? 'Reading permission…' : consent?.granted ? 'Personal AI processing is on.' : 'Personal AI processing is paused.'}</p>}
      {error && <p role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        {consent?.granted ? (
          <button type="button" disabled={busy || loading} onClick={() => { void choose(false); }} style={{ padding: '10px 16px', border: '1px solid currentColor', borderRadius: 6 }}>Pause personal AI</button>
        ) : (
          <>
            <button type="button" disabled={busy || loading} onClick={() => { void choose(true); }} style={{ padding: '10px 16px', border: '1px solid currentColor', borderRadius: 6 }}>Allow OpenAI and Anthropic</button>
            {compact && <button type="button" disabled={busy} onClick={() => { void choose(false); }} style={{ padding: '10px 16px', textDecoration: 'underline' }}>Keep personal AI paused</button>}
          </>
        )}
        {error && <button type="button" disabled={busy} onClick={() => { void load(); }}>Try again</button>}
      </div>
    </section>
  );
}
