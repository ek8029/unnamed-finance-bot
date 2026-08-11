import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// noindex: reached only via a session handoff from the phone, never from search.
export const metadata: Metadata = {
  title: 'Connect a brokerage | Helm Terminal',
  description: 'Connect a brokerage read-only through Plaid.',
  robots: { index: false, follow: false },
};

/**
 * Takes the session handoff out of the URL before any other script can read it.
 *
 * THE BUG THIS CLOSES. The phone opens /link#at=<access>&rt=<refresh> to carry
 * its Supabase session into the Safari view. The page then stripped the
 * fragment, but only AFTER awaiting `setSession`, which is a network round
 * trip. In that window two other scripts read `location.href`:
 *
 *   - posthog.init() runs in the RENDER BODY of PostHogProvider, so it fires on
 *     first paint. It snapshots the full URL into `$initial_person_info` and
 *     ships it on identify as `$initial_current_url`, a person property that is
 *     retained indefinitely. PostHog's `mask_personal_data_properties` does not
 *     help: it rewrites query parameters and re-appends the fragment verbatim.
 *   - the Plausible tracker POSTs `location.href` with the fragment intact.
 *
 * So a refresh token, which is a renewable 30-day credential that survives a
 * password change, was being written to two third parties on every connect.
 *
 * An inline script in the body executes during HTML parse, before the client
 * bundle hydrates and therefore before either of those runs. The tokens are
 * moved to a global the page reads once, and the address bar is clean from the
 * first frame.
 *
 * THIS IS THE STOPGAP, NOT THE FIX. A URL is the wrong place for a long-lived
 * credential no matter how quickly it is erased: it is still in the Safari
 * view's memory, and on Android the same call uses Chrome Custom Tabs, whose
 * history syncs to the user's Google account. The real fix is a server-minted
 * single-use handoff code with a 60 second TTL, which is all the time this page
 * actually needs to be authenticated. Until then, keep this script first.
 */
const STRIP_HANDOFF = `(function(){try{
var h=window.location.hash||"";
if(h.length>1&&h.indexOf("at=")!==-1){
window.__helmHandoff=h.charAt(0)==="#"?h.slice(1):h;
window.history.replaceState(null,"",window.location.pathname+window.location.search);
}}catch(e){}})();`;

export default function LinkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: STRIP_HANDOFF }} />
      {children}
    </>
  );
}
