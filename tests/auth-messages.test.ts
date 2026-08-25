import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AUTH_MESSAGES } from '../lib/auth-messages';

/**
 * /login resolves `?message=` through AUTH_MESSAGES and renders nothing for an
 * unknown key (deliberately, so a crafted URL cannot inject text onto the
 * sign-in page). The failure mode is therefore silent: a redirect that passes
 * prose instead of a key shows the user nothing at all.
 *
 * That is what happened to the post-signup email-confirmation prompt. This test
 * makes the contract enforceable instead of conventional.
 */
const FILES_THAT_REDIRECT = [
  'app/signup/page.tsx',
  'app/login/page.tsx',
  'components/wrapped/wrapped-landing.tsx',
];

describe('auth message redirects', () => {
  it('every ?message= value in the app is a known AUTH_MESSAGES key', () => {
    const offenders: string[] = [];

    for (const rel of FILES_THAT_REDIRECT) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      // Capture the value after message=, stopping at a quote, &, or backslash.
      for (const match of src.matchAll(/[?&]message=([^'"`&\\\s]+)/g)) {
        const value = decodeURIComponent(match[1]);
        if (value.startsWith('$')) continue; // interpolated, checked by types
        if (!(value in AUTH_MESSAGES)) {
          offenders.push(`${rel} -> "${value.slice(0, 70)}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('every message has non-empty copy and no em dashes', () => {
    for (const [key, copy] of Object.entries(AUTH_MESSAGES)) {
      expect(copy.length, key).toBeGreaterThan(0);
      expect(copy.includes('—'), `${key} contains an em dash`).toBe(false);
    }
  });
});

describe('unconfirmed-email login error', () => {
  it('exists, is not the generic credentials error, and /login uses it', async () => {
    const mod = await import('../lib/auth-messages');
    const copy: string = (mod as Record<string, unknown>).UNCONFIRMED_LOGIN_ERROR as string;
    expect(typeof copy).toBe('string');
    expect(copy.length).toBeGreaterThan(0);
    expect(copy.includes('—')).toBe(false);
    expect(/invalid/i.test(copy)).toBe(false);
    expect(/confirm/i.test(copy)).toBe(true);
    const login = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8');
    expect(login).toContain('UNCONFIRMED_LOGIN_ERROR');
  });
});
