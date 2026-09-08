// lib/posthog-server.ts
// Keep server analytics alive after the route response. This is best-effort,
// not a durable outbox; Stripe remains the source of truth for payments.
import { after } from 'next/server';

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

export function captureServer(event: string, distinctId: string, properties: Record<string, unknown> = {}): void {
  if (!TOKEN) return;
  const payload = JSON.stringify({
    api_key: TOKEN, event, distinct_id: distinctId,
    properties: { ...properties, source: 'server' }, timestamp: new Date().toISOString(),
  });
  after(async () => {
    try {
      const response = await fetch(`${HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) console.warn('[posthog] Capture rejected', { event, status: response.status });
    } catch { console.warn('[posthog] Capture failed', { event }); }
  });
}
