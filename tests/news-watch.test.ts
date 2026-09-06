import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { rotationSlice, slotFor, NEWS_SLICE, NEWS_PERIOD_MIN } from '@/lib/news-watch';

describe('rotationSlice', () => {
  const names = Array.from({ length: 319 }, (_, i) => `T${String(i).padStart(3, '0')}`);

  it('covers every name across consecutive slots and then wraps', () => {
    const seen = new Set<string>();
    const ticks = Math.ceil(names.length / NEWS_SLICE);
    for (let slot = 1000; slot < 1000 + ticks; slot++) for (const t of rotationSlice(names, slot, NEWS_SLICE)) seen.add(t);
    expect(seen.size).toBe(names.length);
    // eight ticks of five minutes: every name read inside 40 minutes
    expect(ticks * NEWS_PERIOD_MIN).toBeLessThanOrEqual(40);
  });

  it('is a pure function of the slot, so every instance reads the same slice', () => {
    expect(rotationSlice(names, 7, 40)).toEqual(rotationSlice(names, 7, 40));
    expect(rotationSlice(names, 7, 40)).not.toEqual(rotationSlice(names, 8, 40));
    expect(rotationSlice(names, 8, 40)[0]).toBe(names[(8 * 40) % 319]);
  });

  it('returns everything when the list is smaller than the slice, and nothing for nothing', () => {
    expect(rotationSlice(['A', 'B'], 99, 40)).toEqual(['A', 'B']);
    expect(rotationSlice([], 3, 40)).toEqual([]);
  });
});

describe('slotFor', () => {
  it('is stable inside a five-minute window and moves at the boundary', () => {
    expect(slotFor(new Date('2026-09-08T14:00:00Z'))).toBe(slotFor(new Date('2026-09-08T14:04:59Z')));
    expect(slotFor(new Date('2026-09-08T14:05:00Z'))).toBe(slotFor(new Date('2026-09-08T14:00:00Z')) + 1);
  });
});

describe('news watch cron', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.OPENAI_API_KEY ||= 'test-key-never-used';
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/news-watch/route');
    const res = await GET(new Request('http://cron.internal/api/cron/news-watch', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('runs every five minutes, all day', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const run = (cfg.crons as { path: string; schedule: string }[]).find((c) => c.path === '/api/cron/news-watch');
    expect(run?.schedule).toBe('*/5 * * * *');
  });
});
