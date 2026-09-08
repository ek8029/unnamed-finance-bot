import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSurveyDeferral, isSurveySensitiveRoute } from '@/lib/survey-deferral';

afterEach(() => vi.useRealTimers());
describe('surveys wait until critical interactions settle', () => {
  it('starts suppressed, then permits ordinary browsing after a minute', () => {
    vi.useFakeTimers();
    const apply = vi.fn(); const policy = createSurveyDeferral(apply);
    policy.start(); vi.advanceTimersByTime(59_999);
    expect(apply).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(1); expect(apply).toHaveBeenLastCalledWith(false);
  });
  it('waits for both checkout and onboarding before starting cooldown', () => {
    vi.useFakeTimers();
    const apply = vi.fn(); const policy = createSurveyDeferral(apply);
    const releaseSetup = policy.hold(); const releaseCheckout = policy.hold(); policy.start();
    releaseSetup(); vi.advanceTimersByTime(120_000); expect(apply).toHaveBeenLastCalledWith(true);
    releaseCheckout(); vi.advanceTimersByTime(60_000); expect(apply).toHaveBeenLastCalledWith(false);
  });
  it('cancels an imminent survey when checkout opens and tolerates repeated cleanup', () => {
    vi.useFakeTimers();
    const apply = vi.fn(); const policy = createSurveyDeferral(apply); policy.start();
    vi.advanceTimersByTime(59_000); const release = policy.hold();
    vi.advanceTimersByTime(120_000); expect(apply).toHaveBeenLastCalledWith(true);
    release(); release(); vi.advanceTimersByTime(60_000); expect(apply).toHaveBeenLastCalledWith(false);
  });
  it.each(['/signup', '/login', '/auth/callback', '/testing/onboarding'])('suppresses %s', path => {
    expect(isSurveySensitiveRoute(path)).toBe(true);
  });
  it.each(['/', '/dashboard', '/signup-guide', null])('does not permanently suppress %s', path => {
    expect(isSurveySensitiveRoute(path)).toBe(false);
  });
});
