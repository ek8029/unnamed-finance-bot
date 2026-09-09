import { describe, it, expect } from 'vitest';
import { describeLinkExit } from '@/lib/plaid/link-exit';

describe('describeLinkExit', () => {
  it('reports institution_not_found from status when err is null', () => {
    expect(describeLinkExit(null, { status: 'institution_not_found' }, 'Public.com')).toEqual({
      code: 'INSTITUTION_NOT_FOUND', status: 'institution_not_found', institutionName: null, searchQuery: 'Public.com',
    });
  });
  it('reports the Plaid error code and the institution the user picked', () => {
    expect(describeLinkExit({ error_code: 'INVALID_CREDENTIALS' }, { status: 'requires_credentials', institution: { name: 'Fidelity' } }, null)).toEqual({
      code: 'INVALID_CREDENTIALS', status: 'requires_credentials', institutionName: 'Fidelity', searchQuery: null,
    });
  });
  it('reports a plain close as code null', () => {
    expect(describeLinkExit(null, { status: null }, null)).toEqual({ code: null, status: null, institutionName: null, searchQuery: null });
  });
  it('never throws on missing metadata', () => {
    expect(describeLinkExit(undefined, undefined, undefined).code).toBeNull();
  });
  it('keeps an empty error_code instead of reading it as a plain close', () => {
    expect(describeLinkExit({ error_code: '' }, { status: 'x' }, null).code).toBe('');
  });
});
