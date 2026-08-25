import { describe, it, expect } from 'vitest';
import { resolveLinkExitError, PLAID_ERROR_MESSAGES } from '../lib/plaid/link-exit';

/**
 * Plaid Link reports "institution not found" as metadata.status with err === null.
 * The friendly message for it lived behind `if (err)`, so the one exit that
 * most needs a next step (import your holdings instead) showed nothing.
 */
describe('resolveLinkExitError', () => {
  it('maps institution_not_found (no err) to the import-path message', () => {
    const r = resolveLinkExitError(null, 'institution_not_found');
    expect(r?.code).toBe('INSTITUTION_NOT_FOUND');
    expect(r?.message).toBe(PLAID_ERROR_MESSAGES.INSTITUTION_NOT_FOUND);
    expect(r?.message).toContain('Webull');
  });

  it('maps a known error code', () => {
    const r = resolveLinkExitError({ error_code: 'INVALID_CREDENTIALS' }, 'requires_credentials');
    expect(r).toEqual({ code: 'INVALID_CREDENTIALS', message: PLAID_ERROR_MESSAGES.INVALID_CREDENTIALS });
  });

  it('falls back to Plaid display_message, then a generic line', () => {
    expect(resolveLinkExitError({ error_code: 'WEIRD', display_message: 'Bank says no' }, null)?.message).toBe('Bank says no');
    expect(resolveLinkExitError({}, null)?.message).toMatch(/try again/i);
  });

  it('is silent for a plain close or a credentials-pane exit without an error', () => {
    expect(resolveLinkExitError(null, null)).toBeNull();
    expect(resolveLinkExitError(null, 'requires_credentials')).toBeNull();
    expect(resolveLinkExitError(null, 'requires_oauth')).toBeNull();
  });
});
