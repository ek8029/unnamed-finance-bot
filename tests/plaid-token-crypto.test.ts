import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { sealToken, openToken, isSealed, readItemToken } from '../lib/plaid/token-crypto';

const KEY = randomBytes(32).toString('base64');
const TOKEN = 'access-production-1234abcd-5678-efgh-9012-ijklmnopqrst';

describe('sealToken / openToken', () => {
  beforeEach(() => { process.env.PLAID_TOKEN_KEY = KEY; });
  afterEach(() => { delete process.env.PLAID_TOKEN_KEY; });

  it('round-trips a token and never stores it in the clear', () => {
    const sealed = sealToken(TOKEN);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain(TOKEN);
    expect(sealed.split(':')).toHaveLength(5); // enc:v1:iv:ct:tag
    expect(openToken(sealed)).toBe(TOKEN);
  });

  it('uses a fresh IV every time, so equal tokens do not produce equal ciphertext', () => {
    expect(sealToken(TOKEN)).not.toBe(sealToken(TOKEN));
  });

  it('refuses a tampered ciphertext instead of returning garbage', () => {
    const sealed = sealToken(TOKEN);
    const parts = sealed.split(':');
    const ct = Buffer.from(parts[3], 'base64');
    ct[0] ^= 0xff;
    parts[3] = ct.toString('base64');
    expect(() => openToken(parts.join(':'))).toThrow();
  });

  it('does not double-seal an already sealed value', () => {
    const sealed = sealToken(TOKEN);
    expect(sealToken(sealed)).toBe(sealed);
  });

  it('passes a legacy plaintext row through unchanged', () => {
    expect(openToken(TOKEN)).toBe(TOKEN);
  });

  it('rejects a key of the wrong length', () => {
    process.env.PLAID_TOKEN_KEY = Buffer.from('short').toString('base64');
    expect(() => sealToken(TOKEN)).toThrow(/32 bytes/);
  });
});

describe('without PLAID_TOKEN_KEY', () => {
  let sealedElsewhere: string;
  beforeEach(() => {
    process.env.PLAID_TOKEN_KEY = KEY;
    sealedElsewhere = sealToken(TOKEN);
    delete process.env.PLAID_TOKEN_KEY;
  });

  it('stores plaintext rather than breaking linking', () => {
    expect(sealToken(TOKEN)).toBe(TOKEN);
  });

  it('throws on a sealed value rather than handing ciphertext to Plaid', () => {
    expect(() => openToken(sealedElsewhere)).toThrow(/PLAID_TOKEN_KEY/);
  });
});

describe('readItemToken', () => {
  beforeEach(() => { process.env.PLAID_TOKEN_KEY = KEY; });
  afterEach(() => { delete process.env.PLAID_TOKEN_KEY; });

  function fakeClient() {
    const calls: Array<{ table: string; update: Record<string, string>; eq: Array<[string, string]> }> = [];
    const client = {
      from(table: string) {
        const call = { table, update: {} as Record<string, string>, eq: [] as Array<[string, string]> };
        calls.push(call);
        const chain = {
          update(v: Record<string, string>) { call.update = v; return chain; },
          eq(col: string, val: string) { call.eq.push([col, val]); return chain; },
          then(resolve: (v: { error: null }) => void) { resolve({ error: null }); },
        };
        return chain;
      },
    };
    return { client, calls };
  }

  it('re-seals a legacy plaintext row in place, keyed on the old value so a concurrent seal cannot clobber', async () => {
    const { client, calls } = fakeClient();
    const plain = await readItemToken(client, { id: 'item-1', plaid_access_token: TOKEN });
    expect(plain).toBe(TOKEN);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('plaid_items');
    expect(isSealed(calls[0].update.plaid_access_token)).toBe(true);
    expect(openToken(calls[0].update.plaid_access_token)).toBe(TOKEN);
    expect(calls[0].eq).toEqual([['id', 'item-1'], ['plaid_access_token', TOKEN]]);
  });

  it('leaves an already sealed row alone', async () => {
    const { client, calls } = fakeClient();
    const sealed = sealToken(TOKEN);
    expect(await readItemToken(client, { id: 'item-2', plaid_access_token: sealed })).toBe(TOKEN);
    expect(calls).toHaveLength(0);
  });

  it('does not touch the row when there is no key to seal with', async () => {
    delete process.env.PLAID_TOKEN_KEY;
    const { client, calls } = fakeClient();
    expect(await readItemToken(client, { id: 'item-3', plaid_access_token: TOKEN })).toBe(TOKEN);
    expect(calls).toHaveLength(0);
  });
});

describe('no route joins on the raw access token any more', () => {
  const ROOT = join(__dirname, '..');
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  }

  it('app/ and lib/ never filter linked_accounts by plaid_access_token or write the token into it', () => {
    const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))];
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /\.eq\(\s*'plaid_access_token'/.test(src) || /a\.plaid_access_token === item\.plaid_access_token/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('the only place a token is written to plaid_items seals it first', () => {
    const src = readFileSync(join(ROOT, 'app/api/plaid/exchange-public-token/route.ts'), 'utf8');
    expect(src).toMatch(/plaid_access_token:\s*sealToken\(/);
    expect(src).not.toMatch(/plaid_access_token:\s*accessToken\b/);
  });
});
