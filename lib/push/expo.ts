// lib/push/expo.ts
// The transport: Expo's push service, which holds the APNs connection so a
// Vercel function never has to. Send returns tickets; receipts come later and
// say whether APNs took the message and whether the token is still alive.

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHUNK = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export function isExpoPushToken(t: unknown): t is string {
  return typeof t === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(t);
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) h.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  return h;
}

/** One ticket per message, in order. A transport failure yields error tickets, never a throw. */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  const out: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(SEND_URL, { method: 'POST', headers: headers(), body: JSON.stringify(chunk) });
      const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[]; errors?: { message?: string }[] };
      if (!res.ok || !Array.isArray(json.data)) {
        const msg = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
        out.push(...chunk.map(() => ({ status: 'error' as const, message: msg })));
        continue;
      }
      out.push(...json.data);
    } catch (err) {
      out.push(...chunk.map(() => ({ status: 'error' as const, message: err instanceof Error ? err.message : String(err) })));
    }
  }
  return out;
}

/** Receipts by ticket id. Missing ids are still in flight. */
export async function getExpoReceipts(ids: string[]): Promise<Record<string, ExpoReceipt>> {
  const out: Record<string, ExpoReceipt> = {};
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetch(RECEIPTS_URL, { method: 'POST', headers: headers(), body: JSON.stringify({ ids: chunk }) });
      const json = (await res.json().catch(() => ({}))) as { data?: Record<string, ExpoReceipt> };
      if (res.ok && json.data) Object.assign(out, json.data);
    } catch {
      // Still in flight as far as this pass is concerned; the next one asks again.
    }
  }
  return out;
}
