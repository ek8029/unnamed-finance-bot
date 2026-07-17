// lib/posthog-server.ts
// Fire-and-forget server-side PostHog capture. Client-side capture misses
// server-only funnel moments (watch subscribe/confirm happen in API routes with
// no page JS guaranteed). Never throws, never blocks the caller's response.

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

export function captureServer(event: string, distinctId: string, properties: Record<string, unknown> = {}): void {
  if (!TOKEN) return;
  void fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TOKEN,
      event,
      distinct_id: distinctId,
      properties: { ...properties, source: 'server' },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => { /* analytics must never break product paths */ });
}
