import { safeNext } from '@/lib/checkout-intent';

export const AUTH_CHANGE_KEY = 'helm:auth-change';

/** Legacy caches with no owner key must not survive an account boundary.
 * Keep auth tokens, explicit analytics opt-out and pending checkout intact. */
export function clearAccountBrowserData(): void {
  try {
    const legacy = JSON.parse(localStorage.getItem('helm-settings') || '{}');
    if (legacy.analyticsEnabled === false) localStorage.setItem('helm:analytics-enabled', 'false');
  } catch { /* inaccessible or invalid legacy storage */ }
  for (const key of ['helm-settings', 'helm_dismissed_alerts']) {
    try { localStorage.removeItem(key); } catch { /* blocked storage */ }
  }
  for (const key of ['helm_research_history', 'helm_demo_mode']) {
    try { sessionStorage.removeItem(key); } catch { /* blocked storage */ }
  }
}

/** Call after establishing/revoking cookies. A new document discards URL-keyed
 * API caches and mounted account state; router.refresh preserves them. */
export function navigateAfterAuth(destination: string): void {
  clearAccountBrowserData();
  try { localStorage.setItem(AUTH_CHANGE_KEY, crypto.randomUUID()); } catch { /* navigation must still work */ }
  window.location.replace(safeNext(destination));
}

/** Other tabs share cookies but have separate React and sessionStorage state. */
export function watchAccountChanges(onChange: () => void): () => void {
  const refresh = () => {
    clearAccountBrowserData();
    onChange();
    window.location.reload();
  };
  const storage = (event: StorageEvent) => { if (event.key === AUTH_CHANGE_KEY) refresh(); };
  const pageshow = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
  window.addEventListener('storage', storage);
  window.addEventListener('pageshow', pageshow);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener('pageshow', pageshow);
  };
}
