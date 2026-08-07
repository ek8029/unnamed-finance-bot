'use client';

/**
 * /link — the brokerage connect flow, sized for an in-app browser.
 *
 * The iOS app opens this inside a Safari view rather than shipping Plaid's
 * native SDK. That SDK is a native module Expo Go cannot load, and its OAuth
 * redirects need the Associated Domains entitlement, which a free Apple team
 * does not grant. This page needs neither, so a brokerage can be connected from
 * the phone today instead of after the Apple account clears.
 *
 * It is deliberately not /dashboard: one job, one button, no nav, and a
 * finished state that tells the person to go back to the app.
 *
 * SESSION HANDOFF. A Safari view does not share the app's session, so the app
 * passes its Supabase tokens in the URL FRAGMENT. Fragments are never sent to
 * the server, so the token cannot land in an access log or a proxy. It is the
 * same mechanism Supabase's own implicit OAuth redirect uses. The fragment is
 * stripped from history the moment the session is set.
 */

import { useCallback, useEffect, useState } from 'react';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { createClient } from '@/lib/supabase/client';

type Phase = 'starting' | 'ready' | 'done' | 'signedout' | 'error';

export default function LinkPage() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const p = new URLSearchParams(hash.replace(/^#/, ''));
      const access_token = p.get('at');
      const refresh_token = p.get('rt');

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        // Drop the tokens out of the address bar and the history entry as soon
        // as they have been used.
        window.history.replaceState(null, '', window.location.pathname);
        if (error) {
          setPhase('signedout');
          return;
        }
        setPhase('ready');
        return;
      }

      // Opened without a handoff: fall back to whatever session the browser has.
      const { data } = await supabase.auth.getUser();
      setPhase(data.user ? 'ready' : 'signedout');
    })();
  }, []);

  const onSuccess = useCallback(() => setPhase('done'), []);
  const onError = useCallback((e: string) => { setMessage(e); setPhase('error'); }, []);

  return (
    <main
      style={{ background: '#060606', minHeight: '100svh', color: '#FAFAFA' }}
      className="flex flex-col items-center justify-center px-7 text-center"
    >
      <div className="w-full max-w-sm">
        <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.24em] text-[#E6B94D]"
          style={{ fontFamily: 'var(--font-mono)' }}>
          HELM
        </p>

        {phase === 'starting' && (
          <p className="m-0 mt-8 text-[15px] text-[#8A8A8A]">Getting ready…</p>
        )}

        {phase === 'ready' && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Connect a brokerage.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              Read-only through Plaid. Helm can never trade or move money, and you can disconnect
              in one tap at any time.
            </p>
            <div className="mt-8">
              <PlaidLinkButton onSuccess={onSuccess} onError={onError} className="w-full">
                Choose your brokerage
              </PlaidLinkButton>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Connected.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              Helm is pulling your positions now. Close this and go back to the app; it will be
              there in a moment.
            </p>
          </>
        )}

        {phase === 'signedout' && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Sign in first.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              Helm needs to know whose book this is before it can connect anything.
            </p>
            <a href="/login?next=/link"
              className="mt-7 inline-flex w-full items-center justify-center rounded-[10px] px-6 py-3.5 text-[15px] font-semibold"
              style={{ background: '#E6B94D', color: '#0A0A0A' }}>
              Sign in
            </a>
          </>
        )}

        {phase === 'error' && (
          <>
            <h1 className="m-0 mt-7 text-[23px] font-semibold leading-[1.25] tracking-[-0.02em]">
              That did not go through.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              {message ?? 'Something went wrong connecting your brokerage.'}
            </p>
            <button onClick={() => { setMessage(null); setPhase('ready'); }}
              className="mt-7 w-full rounded-[10px] px-6 py-3.5 text-[15px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#FAFAFA' }}>
              Try again
            </button>
          </>
        )}

        <p className="m-0 mt-10 text-[11px] leading-[1.6] text-[#5F5F5F]">
          Helm Financial, Corp. is not a registered investment adviser and does not make
          recommendations.
        </p>
      </div>
    </main>
  );
}
