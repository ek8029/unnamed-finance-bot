// tests/digest-preview.test.ts
import { describe, it, expect } from 'vitest';
import { briefDigestFields, digestPreview, DIGEST_PREVIEW_CHARS } from '@/lib/digest-preview';
import { digestEmailPayload } from '@/lib/emails/digest-send';

const long = `${'NVDA led the book higher after the filing. '.repeat(8)}\n\nSecond paragraph, Pro only.`;
const row = { digest: long, generated_at: '2026-09-27T13:15:00Z' };

describe('digestPreview', () => {
  it('is the first paragraph, cut at 200 characters', () => {
    expect(digestPreview('Short lead.\n\nThe rest.')).toBe('Short lead.');
    expect(digestPreview(long)).toHaveLength(DIGEST_PREVIEW_CHARS);
    expect(long.startsWith(digestPreview(long))).toBe(true);
  });

  it('is exactly what the morning email carries', () => {
    const email = digestEmailPayload({ id: 'u1', email: 'someone@example.com', firstName: 'Sam' }, long);
    expect(email.text).toContain(`${digestPreview(long)}...`);
    expect(email.text).not.toContain('Second paragraph');
  });
});

describe('briefDigestFields', () => {
  it('gives a free account the preview and never the digest', () => {
    const f = briefDigestFields(false, row);
    expect(f.digest).toBeNull();
    expect(f.digestGeneratedAt).toBeNull();
    expect(f.digestPreview).toBe(digestPreview(long));
    expect(f.digestPreview).not.toContain('Second paragraph');
  });

  it('gives Pro the whole digest and no preview', () => {
    expect(briefDigestFields(true, row)).toEqual({ digest: long, digestGeneratedAt: row.generated_at, digestPreview: null });
  });

  it('has no preview when nothing was written', () => {
    expect(briefDigestFields(false, null).digestPreview).toBeNull();
    expect(briefDigestFields(false, { digest: null, generated_at: null }).digestPreview).toBeNull();
    expect(briefDigestFields(false, { digest: '   \n\nBody', generated_at: null }).digestPreview).toBeNull();
    expect(briefDigestFields(true, null)).toEqual({ digest: null, digestGeneratedAt: null, digestPreview: null });
  });
});
