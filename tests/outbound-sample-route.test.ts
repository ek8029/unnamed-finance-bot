import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/lib/emails/resend', () => ({ resend: { emails: { send: mocks.send } }, FROM_EMAIL: 'sender@example.test' }));

import { POST } from '@/app/api/outbound/sample/route';

let ipCounter = 0;
// The rate limiter is an in-memory map keyed by IP, so each test gets its own.
function freshIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

const valid = {
  name: 'Maria Lopez',
  business: 'Brightline Cleaning',
  email: 'Maria@Example.test',
  phone: '',
  sells: 'Commercial cleaning for offices',
  targets: 'Property managers',
  area: 'Queens',
  exclude: 'Current clients',
  website: '',
  elapsedMs: 9000,
};

function request(body: unknown, ip = freshIp()) {
  return new Request('http://localhost/api/outbound/sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
});

describe('POST /api/outbound/sample', () => {
  it('emails the request to Evan with reply-to set to the sender', async () => {
    const res = await POST(request(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sent = mocks.send.mock.calls[0][0];
    expect(sent.to).toBe('evan@helmterminal.dev');
    expect(sent.replyTo).toBe('maria@example.test');
    expect(sent.subject).toBe('Free sample request: Brightline Cleaning');
    expect(sent.text).toContain('What you sell: Commercial cleaning for offices');
    expect(sent.text).toContain('Names to leave out: Current clients');
    // Empty optional fields are left out of the email.
    expect(sent.text).not.toContain('Phone');
  });

  it('rejects a missing required field and sends nothing', async () => {
    const res = await POST(request({ ...valid, area: '   ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: 'area' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects an email address that does not parse', async () => {
    const res = await POST(request({ ...valid, email: 'maria at example' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: 'email' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects an over-long field', async () => {
    const res = await POST(request({ ...valid, sells: 'x'.repeat(401) }));
    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('flattens line breaks in single-line fields so the subject stays one line', async () => {
    await POST(request({ ...valid, business: 'Bright\r\nline' }));
    expect(mocks.send.mock.calls[0][0].subject).toBe('Free sample request: Bright line');
  });

  it('answers a filled honeypot as success without sending', async () => {
    const res = await POST(request({ ...valid, website: 'https://spam.example' }));
    expect(res.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('answers a too-fast submission as success without sending', async () => {
    const res = await POST(request({ ...valid, elapsedMs: 400 }));
    expect(res.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('reports a provider failure instead of claiming success', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: 'rejected' } });
    const res = await POST(request(valid));
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
  });

  it('rejects a body that is not JSON', async () => {
    const res = await POST(request('not json'));
    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('limits one address to five requests an hour', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect((await POST(request(valid, ip))).status).toBe(200);
    }
    const res = await POST(request(valid, ip));
    expect(res.status).toBe(429);
    expect(mocks.send).toHaveBeenCalledTimes(5);
  });
});
