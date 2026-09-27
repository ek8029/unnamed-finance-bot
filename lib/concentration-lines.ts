// lib/concentration-lines.ts
//
// ONE concentration rule, shared by the insights engine, the phone and any
// surface that draws "this is over the line".
//
// There were three. The phone kept a risk profile in AsyncStorage (30/20/12%
// per position, with sector lines nobody read), Overview on the phone drew a
// hard-coded 35% sector line, and the engine that writes the persistent
// "X is N% of your portfolio" finding used 25% single-name and 40% sector. A
// person who picked Passive on the phone was told 12% on one screen and 25% in
// their Actions inbox, and Account promised "Helm never picks the line for you".
//
// Now the choice lives in user_preferences.risk_profile (migration 081) and:
//   - a chosen profile sets the single-position line: 30, 20 or 12 percent,
//     measured with ETF look-through;
//   - no choice means Helm's default line, 25 percent, the engine's old value,
//     so nobody who never chose is moved;
//   - the sector line is one 40 percent for everyone.
//
// These are lines the person adopts, not recommendations: "NVDA is 31% and
// your line is 20%" is arithmetic against a number they picked. Nothing here
// suggests which profile to choose.
//
// helm-mobile/lib/rules.ts mirrors these numbers. Change them here first.

import { CONCENTRATION_THRESHOLDS, SECTOR_CONCENTRATION_THRESHOLD } from '@/lib/financial-config';

export type RiskProfile = 'aggressive' | 'moderate' | 'passive';

export const RISK_PROFILES: readonly RiskProfile[] = ['aggressive', 'moderate', 'passive'];

/** Single-position line, percent of the book, for each profile. */
export const PROFILE_POSITION_LINE: Record<RiskProfile, number> = {
  aggressive: 30,
  moderate: 20,
  passive: 12,
};

/** The line when nobody has chosen one: the engine's historical threshold. */
export const DEFAULT_POSITION_LINE: number = CONCENTRATION_THRESHOLDS.critical;

/** One sector line for everyone. */
export const SECTOR_LINE: number = SECTOR_CONCENTRATION_THRESHOLD;

export interface ConcentrationLines {
  profile: RiskProfile | null;
  /** Percent of the book one position may be before it is over the line. */
  position: number;
  /** Percent of the book one sector may be before it is over the line. */
  sector: number;
  /** True when the person chose the position line; false when it is Helm's default. */
  chosen: boolean;
}

/** A stored or submitted value, or null for anything that is not a known profile. */
export function parseRiskProfile(value: unknown): RiskProfile | null {
  return typeof value === 'string' && (RISK_PROFILES as readonly string[]).includes(value)
    ? (value as RiskProfile)
    : null;
}

export function concentrationLines(profile: RiskProfile | null): ConcentrationLines {
  return {
    profile,
    position: profile ? PROFILE_POSITION_LINE[profile] : DEFAULT_POSITION_LINE,
    sector: SECTOR_LINE,
    chosen: profile !== null,
  };
}

/** How a finding names the line: the person's, or Helm's default. */
export function lineSource(lines: ConcentrationLines): string {
  return lines.chosen ? 'the line you set' : "Helm's default line";
}

type PreferencesReader = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/**
 * The profile a person chose, or null. Never throws: an error (including the
 * column not existing yet, before 081 is applied) reads as "not chosen", which
 * is exactly the behaviour before this file existed.
 */
export async function readRiskProfile(supabase: unknown, userId: string): Promise<RiskProfile | null> {
  try {
    const { data, error } = await (supabase as PreferencesReader)
      .from('user_preferences')
      .select('risk_profile')
      .eq('user_id', userId)
      .limit(1);
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return parseRiskProfile((row as { risk_profile?: unknown } | null | undefined)?.risk_profile);
  } catch {
    return null;
  }
}
