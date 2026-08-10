import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The light theme failed WCAG AA in roughly forty places, all of it traced to
 * two tokens. These pin the fix so a future palette tweak cannot quietly put it
 * back: the values are read out of globals.css rather than hardcoded here, so
 * changing the token without changing its contrast fails the build.
 *
 * Dark theme was measured clean and is not asserted here.
 */

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');

/** Read a token's value from the LIGHT theme block. */
function lightToken(name: string): string {
  // The light block is the second definition of the palette; take the last
  // match so a dark-theme default earlier in the file cannot win.
  const matches = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))];
  expect(matches.length, `token --${name} not found`).toBeGreaterThan(0);
  return matches[matches.length - 1][1];
}

const LIGHT_BG = '#F5F5F5';
const WHITE = '#FFFFFF';

describe('light theme contrast (WCAG AA)', () => {
  it('sanity-checks the contrast helper against known values', () => {
    // Black on white is exactly 21:1; a colour against itself is 1:1.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('muted text clears 4.5:1 on both light surfaces', () => {
    const muted = lightToken('color-text-muted');
    expect(contrast(muted, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('secondary text clears 4.5:1 on both light surfaces', () => {
    const secondary = lightToken('color-text-secondary');
    expect(contrast(secondary, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(secondary, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('gold clears 4.5:1 as text on light surfaces', () => {
    const gold = lightToken('color-gold');
    expect(contrast(gold, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(gold, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the primary CTA label clears 4.5:1 ON the gold fill', () => {
    // This is the "Start 14 day free trial" button, which failed in both
    // directions before: gold-as-text AND label-on-gold were the same 2.68:1.
    const gold = lightToken('color-gold');
    expect(contrast(LIGHT_BG, gold)).toBeGreaterThanOrEqual(4.5);
  });

  it('rejects the specific values that were failing', () => {
    // Regression guard with the old values named, so reintroducing either is
    // an obvious failure rather than a silent one.
    expect(contrast('#8A94A6', LIGHT_BG)).toBeLessThan(4.5);
    expect(contrast('#B8914A', LIGHT_BG)).toBeLessThan(4.5);
  });
});
