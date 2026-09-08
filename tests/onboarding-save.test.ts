import { describe, expect, it, vi } from 'vitest';
import { saveOnboardingReasons } from '@/lib/onboarding-save';

const reason = { id: 'p1', confirmed: true, lifecycle: 'confirmed', claim: 'Growth', breaks_if: 'Revenue falls' };
const saved = (tracked = true, pillars = [reason]) => ({ thesis: { id: 't1', tracked }, pillars });
function responses(...steps: { status?: number; body?: unknown }[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const next = steps.shift();
    if (!next) throw new Error('Unexpected request');
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status ?? 200 });
  });
}
const house = { ticker: 'NVDA', selected: ['p1'] };
describe('onboarding saved-value handoff', () => {
  it('requires read-back before reporting a successful adoption', async () => {
    const request = responses({}, { body: saved() });
    await expect(saveOnboardingReasons(house, request)).resolves.toEqual({ thesisId: 't1', monitored: true, existing: false });
    expect(request.mock.calls[1][1]?.cache).toBe('no-store');
  });
  it('does not advance after a failed save', async () => {
    const request = responses({ status: 500, body: { error: 'Save failed' } });
    await expect(saveOnboardingReasons(house, request)).rejects.toThrow('Save failed');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not equate a conflict with confirmed saved work', async () => {
    await expect(saveOnboardingReasons(house, responses({ status: 409 }, { body: saved(false, []) }))).rejects.toThrow('not confirmed');
  });
  it('identifies verified existing work without claiming new choices were saved', async () => {
    await expect(saveOnboardingReasons(house, responses({ status: 409 }, { body: saved() }))).resolves.toMatchObject({ existing: true });
  });
  it('does not advance when verification is unavailable', async () => {
    await expect(saveOnboardingReasons(house, responses({}, { status: 503 }))).rejects.toThrow('verify');
  });
  it('keeps saved and monitored states separate when tracking hits a plan limit', async () => {
    const request = responses({ body: saved(false) }, {}, { status: 403 }, { body: saved(false) });
    await expect(saveOnboardingReasons({ ...house, drafted: true }, request)).resolves.toMatchObject({ monitored: false });
  });
  it('stops a partial draft save before tracking or claiming success', async () => {
    const request = responses({ body: saved(false) }, { status: 500 });
    await expect(saveOnboardingReasons({ ...house, drafted: true }, request)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('writes a custom reason and its condition as a pillar, not a note', async () => {
    const request = responses({ body: saved(false, []) }, {}, {}, { body: saved() });
    await saveOnboardingReasons({ ticker: 'NVDA', drafted: true, selected: [], customReason: 'Growth', customBreaksIf: 'Revenue falls' }, request);
    expect(request.mock.calls[1][1]?.method).toBe('POST');
    expect(JSON.parse(request.mock.calls[1][1]?.body as string)).toEqual({ claim: 'Growth', breaks_if: 'Revenue falls' });
  });
  it('does not duplicate a custom reason or delete prior confirmed work on retry', async () => {
    const request = responses({ body: saved() }, {}, { body: saved() });
    await saveOnboardingReasons({ ticker: 'NVDA', drafted: true, pillars: [{ id: 'p1' }], selected: [], customReason: 'Growth', customBreaksIf: 'Revenue falls' }, request);
    expect(request.mock.calls.map(call => call[1]?.method)).toEqual([undefined, 'PATCH', undefined]);
  });
  it('rejects an empty selection before any request', async () => {
    const request = responses();
    await expect(saveOnboardingReasons({ ticker: 'NVDA', selected: [] }, request)).rejects.toThrow('Choose');
    expect(request).not.toHaveBeenCalled();
  });
});
