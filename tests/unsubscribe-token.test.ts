import { describe, it, expect } from 'vitest';
import { signUnsub, verifyUnsub, unsubUrl } from '../lib/emails/unsubscribe';

const UID = '11111111-2222-3333-4444-555555555555';

describe('email unsubscribe token', () => {
  it('verifies a token it signed', () => {
    expect(verifyUnsub(UID, 'brief', signUnsub(UID, 'brief'))).toBe(true);
    expect(verifyUnsub(UID, 'market', signUnsub(UID, 'market'))).toBe(true);
  });

  it('rejects a token for a different user', () => {
    const other = '99999999-2222-3333-4444-555555555555';
    expect(verifyUnsub(other, 'brief', signUnsub(UID, 'brief'))).toBe(false);
  });

  it('rejects a token for a different kind', () => {
    expect(verifyUnsub(UID, 'market', signUnsub(UID, 'brief'))).toBe(false);
  });

  it('rejects a tampered/empty token', () => {
    expect(verifyUnsub(UID, 'brief', '')).toBe(false);
    expect(verifyUnsub(UID, 'brief', 'deadbeef')).toBe(false);
    const good = signUnsub(UID, 'brief');
    expect(verifyUnsub(UID, 'brief', good.slice(0, -1) + (good.endsWith('a') ? 'b' : 'a'))).toBe(false);
  });

  it('builds a url carrying u, k and a valid t', () => {
    const url = unsubUrl(UID, 'brief');
    const q = new URL(url).searchParams;
    expect(q.get('u')).toBe(UID);
    expect(q.get('k')).toBe('brief');
    expect(verifyUnsub(UID, 'brief', q.get('t') ?? '')).toBe(true);
  });
});
