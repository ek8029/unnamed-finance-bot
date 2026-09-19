// Plausible shares the account preference gate with PostHog. No automatic
// pageviews: URL query strings can contain account/recovery information.
type Plausible = ((event: string, options: { url: string }) => void) & {
  q?: unknown[][];
  init: (options: Record<string, unknown>) => void;
  o?: Record<string, unknown>;
};
let enabled = false;
let loaded = false;
let loading = false;

function client() {
  return window as typeof window & { plausible?: Plausible };
}

export function captureBrowserPageview() {
  if (!enabled || !loaded) return;
  client().plausible?.('pageview', { url: window.location.origin + window.location.pathname });
}

export function setBrowserPageAnalytics(allowed: boolean) {
  enabled = allowed;
  if (!allowed || typeof window === 'undefined') return;
  if (loaded) { captureBrowserPageview(); return; }
  if (loading) return;
  loading = true;
  const plausible = client().plausible || Object.assign(
    function (...args: unknown[]) { (plausible.q ||= []).push(args); },
    { init(options: Record<string, unknown>) { plausible.o = options; } },
  ) as Plausible;
  client().plausible = plausible;
  plausible.init({
    autoCapturePageviews: false,
    // Recheck at delivery as well as capture: preference can change while
    // the SDK is loading or a request is queued.
    transformRequest: (payload: unknown) => enabled ? payload : null,
  });
  const script = document.createElement('script');
  script.src = 'https://plausible.io/js/pa-O3gPqcGXLE6Ju_7Ulgsf6.js';
  script.async = true;
  script.onload = () => { loaded = true; loading = false; captureBrowserPageview(); };
  script.onerror = () => { loading = false; script.remove(); };
  document.head.appendChild(script);
}
