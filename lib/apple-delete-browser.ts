'use client';

interface AppleSdk {
  auth: {
    init: (config: { clientId: string; scope: string; redirectURI: string; state: string; usePopup: boolean }) => void;
    signIn: () => Promise<{ authorization: { code: string; id_token: string; state: string } }>;
  };
}
const appleWindow = () => window as Window & { AppleID?: AppleSdk };
let loading: Promise<void> | null = null;

/** Preload while the confirmation dialog is being prepared so signIn() remains
 * in the user's click, which browsers require to open Apple's popup. */
export function prepareAppleDeletion(): Promise<void> {
  if (appleWindow().AppleID) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    const fail = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error('Could not load Sign in with Apple. Please try again.')); };
    const timer = setTimeout(fail, 15_000);
    script.onload = () => { clearTimeout(timer); if (appleWindow().AppleID) resolve(); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

export async function getAppleDeletionProof() {
  const clientId = process.env.NEXT_PUBLIC_APPLE_WEB_CLIENT_ID;
  const redirectURI = process.env.NEXT_PUBLIC_APPLE_WEB_REDIRECT_URI;
  if (!clientId || !redirectURI) {
    throw new Error('Apple confirmation is unavailable on the website. Delete from Account in the Helm iPhone app, or contact support@helmterminal.dev.');
  }
  const sdk = appleWindow().AppleID;
  if (!sdk) { void prepareAppleDeletion().catch(() => {}); throw new Error('Sign in with Apple is loading. Please tap Delete again in a moment.'); }
  const state = crypto.randomUUID();
  sdk.auth.init({ clientId, redirectURI, scope: '', state, usePopup: true });
  let result;
  try { result = await sdk.auth.signIn(); }
  catch { throw new Error('Apple confirmation did not complete. Your account has not been deleted.'); }
  if (result.authorization.state !== state || !result.authorization.code || !result.authorization.id_token) {
    throw new Error('Could not verify the Apple confirmation. Your account has not been deleted.');
  }
  return { appleAuthorizationCode: result.authorization.code, appleIdentityToken: result.authorization.id_token, appleClientId: clientId };
}
