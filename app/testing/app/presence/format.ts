// Shared formatting for the presence lab screens. Everything is rendered from
// real timestamps; nothing here invents a time.

export const MONO = { fontFamily: 'var(--font-mono)' } as const;

export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function pct(n: number, digits = 0): string {
  return n.toFixed(digits) + '%';
}

/** 9:15 AM ET style clock, in the viewer's zone label. */
export function clock(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

/** "today", "yesterday", "Tue" or "Sep 3" depending on distance. */
export function dayWord(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const et = (x: Date) => new Date(x.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const a = et(d), b = et(now);
  const days = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days === -1) return 'tomorrow';
  if (days > 1 && days < 7) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

/** Calendar day for AHEAD rows: "Thu" inside a week, else "Sep 24". */
export function calDay(dateOnly: string): string {
  const d = new Date(dateOnly + 'T12:00:00Z');
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff <= 6) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function hms(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "1 min ago", "3 hours ago", "2 days ago". Never rounds a real time into a fake one. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const ms = now - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'under a minute ago';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

export const theses = (n: number) => `${n} ${n === 1 ? 'thesis' : 'theses'}`;

/** "Robinhood, Fidelity" from account names like "Robinhood individual". Lab heuristic. */
export function institutions(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean))];
}
