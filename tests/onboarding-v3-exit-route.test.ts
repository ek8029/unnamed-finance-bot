import { describe, it, expect } from 'vitest';
import { routeLinkExit } from '@/lib/onboarding/v3-exit-route';
import { PLAID_ERROR_MESSAGES } from '@/lib/plaid/link-exit';

const d = (code: string | null, extra: Partial<{ status: string | null; institutionName: string | null; searchQuery: string | null }> = {}) =>
  ({ code, status: null, institutionName: null, searchQuery: null, ...extra });

describe('routeLinkExit', () => {
  it('sends institution_not_found to the manual panel naming the search', () => {
    const r = routeLinkExit(d('INSTITUTION_NOT_FOUND', { searchQuery: 'Public.com' }));
    expect(r.to).toBe('manual');
    expect(r.message).toContain('Public.com is not available through Plaid yet');
  });
  it('sends institution_not_found without a query to the manual panel with a generic subject', () => {
    expect(routeLinkExit(d('INSTITUTION_NOT_FOUND')).message).toContain('That brokerage is not available');
  });
  it('sends down, no longer supported and registration required to manual with the link-exit message', () => {
    for (const code of ['INSTITUTION_DOWN', 'INSTITUTION_NO_LONGER_SUPPORTED', 'INSTITUTION_REGISTRATION_REQUIRED']) {
      const r = routeLinkExit(d(code));
      expect(r.to).toBe('manual');
      expect(r.message).toBe(PLAID_ERROR_MESSAGES[code]);
    }
  });
  it('keeps invalid credentials and locked items on the screen with the message', () => {
    for (const code of ['INVALID_CREDENTIALS', 'ITEM_LOCKED']) {
      expect(routeLinkExit(d(code))).toEqual({ to: 'stay', message: PLAID_ERROR_MESSAGES[code] });
    }
  });
  it('does nothing on a plain close', () => {
    expect(routeLinkExit(d(null, { status: 'requires_credentials' }))).toEqual({ to: 'none', message: null });
  });
  it('treats an unknown code as stay with a generic line', () => {
    const r = routeLinkExit(d('SOMETHING_NEW'));
    expect(r.to).toBe('stay');
    expect(r.message).toMatch(/try again/i);
  });
  it('never uses an em dash or advice words', () => {
    for (const code of ['INSTITUTION_NOT_FOUND', 'INSTITUTION_DOWN', 'INVALID_CREDENTIALS', 'SOMETHING_NEW']) {
      const m = routeLinkExit(d(code, { searchQuery: 'X' })).message ?? '';
      expect(m).not.toMatch(/—|!/);
      expect(m.toLowerCase()).not.toMatch(/\b(sell|buy|trim|consider|should)\b/);
    }
  });
});
