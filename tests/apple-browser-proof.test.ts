import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getAppleDeletionProof } from '@/lib/apple-delete-browser';
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APPLE_WEB_CLIENT_ID', 'dev.helm.web');
  vi.stubEnv('NEXT_PUBLIC_APPLE_WEB_REDIRECT_URI', 'https://helmterminal.dev/auth/apple');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function sdk(mode: 'ok' | 'wrong-state' | 'cancel') {
  let state = '';
  const auth = {
    init: vi.fn((config: { state: string }) => { state = config.state; }),
    signIn: vi.fn(async () => {
      if (mode === 'cancel') throw new Error('cancelled');
      return { authorization: { code: 'fresh', id_token: 'identity', state: mode === 'ok' ? state : 'wrong' } };
    }),
  };
  vi.stubGlobal('window', { AppleID: { auth } }); return auth;
}
it('returns fresh proof for the configured Apple web client', async () => {
  const auth = sdk('ok');
  expect(await getAppleDeletionProof()).toEqual({ appleAuthorizationCode: 'fresh', appleIdentityToken: 'identity', appleClientId: 'dev.helm.web' });
  expect(auth.init).toHaveBeenCalledWith(expect.objectContaining({ usePopup: true, clientId: 'dev.helm.web' }));
});
it.each(['wrong-state', 'cancel'] as const)('rejects %s instead of returning deletion credentials', async mode => {
  sdk(mode); await expect(getAppleDeletionProof()).rejects.toThrow('has not been deleted');
});
it('explains the native fallback when web Apple configuration is absent', async () => {
  sdk('ok'); vi.stubEnv('NEXT_PUBLIC_APPLE_WEB_CLIENT_ID', '');
  await expect(getAppleDeletionProof()).rejects.toThrow('Helm iPhone app');
});
