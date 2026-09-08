import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const schedule = vi.hoisted(() => vi.fn());
vi.mock('next/server', () => ({ after: schedule }));

beforeEach(() => {
  vi.resetModules(); schedule.mockReset();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'fixture_token');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://analytics.example.test');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('server analytics response lifetime', () => {
  it('schedules and awaits capture after the response', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', request);
    const { captureServer } = await import('@/lib/posthog-server');
    captureServer('invoice_paid', '11111111-1111-4111-8111-111111111111', { $insert_id: 'fixture_id' });
    expect(request).not.toHaveBeenCalled();
    await schedule.mock.calls[0][0]();
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(request.mock.calls[0][1].body).properties).toEqual({ $insert_id: 'fixture_id', source: 'server' });
  });
  it('surfaces rejected ingestion without throwing from the after callback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { captureServer } = await import('@/lib/posthog-server');
    captureServer('invoice_paid', '11111111-1111-4111-8111-111111111111');
    await expect(schedule.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('[posthog] Capture rejected', { event: 'invoice_paid', status: 503 });
  });
  it('does nothing when analytics is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '');
    const { captureServer } = await import('@/lib/posthog-server');
    captureServer('invoice_paid', '11111111-1111-4111-8111-111111111111');
    expect(schedule).not.toHaveBeenCalled();
  });
});
