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
 * passes its Supabase tokens in the URL FRAGMENT. A fragment is never sent to
 * the origin, which is the only claim that was ever true about it — first-party
 * JavaScript on the page can still read `location.href`, and PostHog and
 * Plausible both did. `app/link/layout.tsx` now removes the fragment during
 * HTML parse, before any of that runs, and leaves it on `window.__helmHandoff`
 * for the effect below. Read that guide before touching this.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { PlaidUpdateLink } from '@/components/plaid/plaid-update-link';
import { createClient } from '@/lib/supabase/client';

type Phase = 'starting' | 'ready' | 'done' | 'signedout' | 'error';

export default function LinkPage() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState<string | null>(null);
  // Reconnect mode: the app passes the broken item in the fragment (item=<id>&inst=<name>) and
  // this page runs Plaid Link's update mode for it instead of a fresh connect.
  const [reconnect, setReconnect] = useState<{ id: string; name: string } | null>(null);
  // Opened from the app with its tokens: the person already chose to connect
  // on the phone, so Link opens by itself instead of asking for a second tap.
  const [fromApp, setFromApp] = useState(false);
  // The brokerage chip tapped on the phone (inst=<name> without item=), for the heading.
  const [institution, setInstitution] = useState<string | null>(null);
  const openRef = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      // Written by the inline script in layout.tsx during HTML parse. The
      // location.hash fallback covers the case where that script did not run;
      // if it is ever the branch that fires, the fragment was readable by every
      // other script on the page for the life of the request.
      const w = window as Window & { __helmHandoff?: string };
      const raw = w.__helmHandoff ?? window.location.hash.replace(/^#/, '');
      delete w.__helmHandoff;
      const p = new URLSearchParams(raw);
      const access_token = p.get('at');
      const refresh_token = p.get('rt');
      const item = p.get('item');
      if (item) setReconnect({ id: item, name: p.get('inst') ?? '' });
      else setInstitution(p.get('inst')?.trim().slice(0, 60) || null);

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        // Belt and braces: layout.tsx has already done this, but a fallback
        // read above means the fragment may still be in the address bar.
        window.history.replaceState(null, '', window.location.pathname);
        if (error) {
          setPhase('signedout');
          return;
        }
        setFromApp(true);
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

  // Open Link once, as soon as the button's link token is ready. openRef
  // returns true only when Link actually opened, so this asks every 250ms
  // for up to 20s and then leaves the button to the person. A token error
  // moves the page to 'error', which ends the wait; "Try again" starts it
  // over, since that tap is a fresh request to connect.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (phase !== 'ready' || !fromApp || reconnect || autoOpened.current) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      if (openRef.current?.()) autoOpened.current = true;
      if (autoOpened.current || Date.now() - started > 20_000) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, fromApp, reconnect]);

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

        {phase === 'ready' && reconnect && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Reconnect {reconnect.name || 'your brokerage'}.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              Your login there stopped working, so Helm stopped updating. Sign in again through
              Plaid and it picks up where it left off. Still read-only.
            </p>
            <div className="mt-8">
              <PlaidUpdateLink
                itemId={reconnect.id}
                institutionName={reconnect.name}
                onSuccess={onSuccess}
                onError={onError}
                className="!h-auto w-full !rounded-[10px] !border-0 !bg-[#E6B94D] px-6 py-3.5 text-[15px] font-semibold !text-[#0A0A0A] hover:!bg-[#E6B94D]"
              >
                Sign in again
              </PlaidUpdateLink>
            </div>
          </>
        )}

        {phase === 'ready' && !reconnect && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              Connect {institution ?? 'a brokerage'}.
            </h1>
            <p className="m-0 mt-3.5 text-[14px] leading-[1.6] text-[#8A8A8A]">
              Read-only through Plaid. Helm can never trade or move money. Disconnect any time
              from Account.
            </p>
            <div className="mt-8">
              <PlaidLinkButton onSuccess={onSuccess} onError={onError} openRef={openRef} className="w-full">
                Choose your brokerage
              </PlaidLinkButton>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <h1 className="m-0 mt-7 text-[25px] font-semibold leading-[1.25] tracking-[-0.02em]">
              {reconnect ? 'Reconnected.' : 'Connected.'}
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
