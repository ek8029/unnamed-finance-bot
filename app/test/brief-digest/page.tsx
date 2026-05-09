'use client';

import { useState } from 'react';

interface DigestResponse {
  digest: string;
  context: {
    holdings: string[];
    positionNewsCount: number;
    generalNewsCount: number;
    market: string;
  };
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
}

export default function BriefDigestTest() {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/test/brief-digest');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setData({ error: String(err), digest: '', context: { holdings: [], positionNewsCount: 0, generalNewsCount: 0, market: '' } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">The Current — AI Digest Test</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        Tests AI-narrated brief digest using sample holdings: AAPL, NVDA, MSFT, GOOGL, TSLA, JPM, VOO, QQQ
      </p>

      <button
        onClick={generate}
        disabled={loading}
        className="h-10 px-6 bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-sm font-semibold rounded-md hover:brightness-110 transition-all disabled:opacity-50 mb-8"
      >
        {loading ? 'Generating...' : 'Generate Digest'}
      </button>

      {data?.error && (
        <div className="p-4 rounded-md bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] text-sm mb-6">
          {data.error}
        </div>
      )}

      {data?.digest && (
        <>
          {/* The digest */}
          <div className="border border-[var(--color-border-base)] rounded-md bg-[var(--color-bg-surface)] overflow-hidden">
            {/* Header bar */}
            <div className="px-6 py-3 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--color-gold)] animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-muted)] uppercase">
                AI Digest — The Current
              </span>
            </div>

            {/* Prose content */}
            <div className="px-6 py-5">
              {data.digest.split('\n\n').map((para, i) => (
                <p
                  key={i}
                  className="text-[15px] leading-[1.75] text-[var(--color-text-secondary)] mb-4 last:mb-0"
                  style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
                >
                  {para}
                </p>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                AI-generated summary · Not financial advice
              </span>
              {data.usage && (
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  {data.usage.total_tokens} tokens
                </span>
              )}
            </div>
          </div>

          {/* Debug context */}
          <details className="mt-6">
            <summary className="text-sm text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
              Debug context
            </summary>
            <pre className="mt-2 p-4 rounded-md bg-[var(--color-bg-elevated)] text-xs text-[var(--color-text-muted)] overflow-x-auto font-mono">
              {JSON.stringify(data.context, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
