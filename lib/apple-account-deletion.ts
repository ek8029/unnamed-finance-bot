import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTPayload } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

export interface AppleDeletionUser {
  identities?: { provider: string; id?: string; identity_data?: { sub?: string } }[];
  app_metadata?: { provider?: string; providers?: string[] };
}
export interface AppleDeletionProof { appleAuthorizationCode?: unknown; appleIdentityToken?: unknown; appleClientId?: unknown }
export class AppleDeletionError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'AppleDeletionError'; }
}

export function appleSubject(user: AppleDeletionUser): string | null {
  const identity = user.identities?.find((entry) => entry.provider === 'apple');
  if (!identity) {
    if (user.app_metadata?.provider === 'apple' || user.app_metadata?.providers?.includes('apple')) {
      throw new AppleDeletionError('APPLE_IDENTITY_UNAVAILABLE', 'Could not verify your Apple account. Try signing in again.', 409);
    }
    return null;
  }
  const subject = identity.identity_data?.sub || identity.id;
  if (!subject) throw new AppleDeletionError('APPLE_IDENTITY_UNAVAILABLE', 'Could not verify your Apple account. Try signing in again.', 409);
  return subject;
}

interface AppleConfig { clientId: string; teamId: string; keyId: string; privateKey: string; redirectUri?: string }
interface AppleDependencies {
  config: (requestedClientId?: unknown) => AppleConfig;
  verify: (token: string, clientId: string) => Promise<JWTPayload>;
  secret: (config: AppleConfig) => Promise<string>;
  post: (path: 'token' | 'revoke', body: URLSearchParams) => Promise<Response>;
}

const dependencies: AppleDependencies = {
  config: (requestedClientId) => {
    const nativeClientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
    const webClientId = process.env.APPLE_SIGN_IN_WEB_CLIENT_ID;
    const clientId = typeof requestedClientId === 'string' ? requestedClientId : nativeClientId;
    if (clientId && clientId !== nativeClientId && clientId !== webClientId) {
      throw new AppleDeletionError('APPLE_IDENTITY_MISMATCH', 'This Apple sign-in client is not registered for Helm.', 403);
    }
    const teamId = process.env.APPLE_SIGN_IN_TEAM_ID;
    const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
    const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
    if (!clientId || !teamId || !keyId || !privateKey) throw new Error('Apple revocation is not configured.');
    const redirectUri = clientId === webClientId ? process.env.APPLE_SIGN_IN_WEB_REDIRECT_URI : undefined;
    if (clientId === webClientId && !redirectUri) throw new Error('Apple web revocation is not configured.');
    return { clientId, teamId, keyId, privateKey: privateKey.replace(/\\n/g, '\n'), redirectUri };
  },
  verify: async (token, clientId) => (await jwtVerify(token, appleKeys, {
    issuer: APPLE_ISSUER, audience: clientId, algorithms: ['RS256'], maxTokenAge: '10 minutes', clockTolerance: 5,
  })).payload,
  secret: async (config) => new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId).setSubject(config.clientId).setAudience(APPLE_ISSUER)
    .setIssuedAt().setExpirationTime('5m')
    .sign(await importPKCS8(config.privateKey, 'ES256')),
  post: (path, body) => fetch(`${APPLE_ISSUER}/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(15_000), cache: 'no-store',
  }),
};

/** Call BEFORE deleting app data. Tokens exist only in this request's memory.
 * A fresh native credential binds the code exchange to the authenticated Helm
 * user's existing Apple identity. Every verification/exchange/revoke failure
 * stops deletion; no API error includes credentials or Apple's raw response. */
export async function revokeAppleForDeletion(user: AppleDeletionUser, proof: AppleDeletionProof, overrides: Partial<AppleDependencies> = {}): Promise<void> {
  const subject = appleSubject(user);
  if (!subject) return;
  if (typeof proof.appleAuthorizationCode !== 'string' || !proof.appleAuthorizationCode ||
      typeof proof.appleIdentityToken !== 'string' || !proof.appleIdentityToken) {
    throw new AppleDeletionError('APPLE_REAUTH_REQUIRED', 'Confirm your Apple account before deleting your Helm account.', 409);
  }
  const deps = { ...dependencies, ...overrides };
  try {
    const config = deps.config(proof.appleClientId);
    const claims = await deps.verify(proof.appleIdentityToken, config.clientId);
    if (claims.sub !== subject) throw new AppleDeletionError('APPLE_IDENTITY_MISMATCH', 'Use the Apple account connected to this Helm account.', 403);
    const secret = await deps.secret(config);
    const exchangeBody = new URLSearchParams({
      client_id: config.clientId, client_secret: secret, grant_type: 'authorization_code', code: proof.appleAuthorizationCode,
    });
    if (config.redirectUri) exchangeBody.set('redirect_uri', config.redirectUri);
    const exchange = await deps.post('token', exchangeBody);
    if (!exchange.ok) throw new Error('Apple code exchange failed.');
    const tokens = await exchange.json() as { id_token?: unknown; refresh_token?: unknown; access_token?: unknown };
    if (typeof tokens.id_token !== 'string') throw new Error('Apple returned no identity token.');
    const exchangedClaims = await deps.verify(tokens.id_token, config.clientId);
    if (exchangedClaims.sub !== subject) throw new AppleDeletionError('APPLE_IDENTITY_MISMATCH', 'Use the Apple account connected to this Helm account.', 403);
    const token = typeof tokens.refresh_token === 'string' && tokens.refresh_token ? tokens.refresh_token : tokens.access_token;
    if (typeof token !== 'string' || !token) throw new Error('Apple returned no revocable token.');
    const result = await deps.post('revoke', new URLSearchParams({
      client_id: config.clientId, client_secret: secret, token,
      token_type_hint: token === tokens.refresh_token ? 'refresh_token' : 'access_token',
    }));
    if (!result.ok || result.status !== 200) throw new Error('Apple revocation failed.');
    const responseText = await result.text();
    if (responseText.trim()) {
      const responseBody = JSON.parse(responseText) as { error?: unknown };
      if (responseBody.error) throw new Error('Apple revocation failed.');
    }
  } catch (error) {
    if (error instanceof AppleDeletionError) throw error;
    throw new AppleDeletionError('APPLE_REVOCATION_UNAVAILABLE', 'Could not verify disconnection of Sign in with Apple. Your account data has been retained. Try again shortly.', 503);
  }
}
