/**
 * Plaid access tokens at rest.
 *
 * A Plaid access token is the read credential to a person's brokerage. Until
 * August 2026 it sat in plaid_items.plaid_access_token as plain text, on an
 * encrypted disk but readable by anything holding the service role. This
 * module seals it with AES-256-GCM before it is written and opens it on read.
 *
 * Storage format: `enc:v1:<iv b64>:<ciphertext b64>:<tag b64>`. Anything
 * without the prefix is a legacy plaintext row and is returned as-is, then
 * re-sealed on its next sync (see readItemToken), so the rollout needs no
 * downtime and no one-shot script, though scripts/encrypt-plaid-tokens.ts
 * exists to finish it in one pass.
 *
 * Key: PLAID_TOKEN_KEY, 32 random bytes, base64. It lives in the environment
 * (Vercel, .env.local), never in the database. With the key unset, sealing is
 * skipped and a warning is logged once, so a deploy that lands before the key
 * does not break linking; opening a sealed value without the key throws,
 * because silently returning ciphertext to the Plaid client would be worse.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
let warnedNoKey = false;

function keyFromEnv(): Buffer | null {
  const raw = process.env.PLAID_TOKEN_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PLAID_TOKEN_KEY must decode to exactly 32 bytes (base64 of 32 random bytes)');
  }
  return key;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Seal a plaintext token for storage. Returns the plaintext unchanged when no key is configured. */
export function sealToken(plain: string): string {
  if (isSealed(plain)) return plain;
  const key = keyFromEnv();
  if (!key) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn('[plaid] PLAID_TOKEN_KEY is not set; access tokens are being stored unsealed');
    }
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, ciphertext, tag].map((b) => b.toString('base64')).join(':');
}

/** Open a stored token. Legacy plaintext passes through; a sealed value needs the key. */
export function openToken(stored: string): string {
  if (!isSealed(stored)) return stored;
  const key = keyFromEnv();
  if (!key) {
    throw new Error('PLAID_TOKEN_KEY is not set but a sealed Plaid token was read');
  }
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('sealed Plaid token is malformed');
  const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Open a plaid_items row's token for use, and if the row is still plaintext
 * and a key exists, seal it in place. Called on every sync, so every legacy
 * row is sealed within one daily cron of the key being set. The rewrite is
 * best-effort: a failure to re-seal never blocks the sync.
 */
export async function readItemToken(
  supabase: AnyClient,
  item: { id: string; plaid_access_token: string },
): Promise<string> {
  const plain = openToken(item.plaid_access_token);
  if (!isSealed(item.plaid_access_token) && keyFromEnv()) {
    const { error } = await supabase
      .from('plaid_items')
      .update({ plaid_access_token: sealToken(plain) })
      .eq('id', item.id)
      .eq('plaid_access_token', item.plaid_access_token);
    if (error) console.warn(`[plaid] could not re-seal token for item ${item.id}: ${error.message}`);
  }
  return plain;
}
