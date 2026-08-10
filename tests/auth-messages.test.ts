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
