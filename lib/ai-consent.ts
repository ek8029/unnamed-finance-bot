import type { SupabaseClient } from '@supabase/supabase-js';

/** Increment when the disclosed providers, data, or purposes materially change. */
export const AI_CONSENT_VERSION = '2026-09-07';
export const AI_CONSENT_REQUIRED = {
  code: 'AI_CONSENT_REQUIRED',
  error: 'Allow personal AI processing in Account or Settings > Data & privacy to use this feature.',
};

export interface AiConsent {
  granted: boolean;
  version: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

/** No cache: withdrawals apply to the next job/request. Database failures deny access. */
export async function readAiConsent(db: SupabaseClient, userId: string): Promise<AiConsent> {
  const { data, error } = await db.from('user_ai_consents')
    .select('version, granted_at, revoked_at').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('AI consent is temporarily unavailable.');
  return {
    granted: data?.version === AI_CONSENT_VERSION && Number.isFinite(Date.parse(data?.granted_at ?? '')) && !data?.revoked_at,
    version: AI_CONSENT_VERSION,
    grantedAt: data?.granted_at ?? null,
    revokedAt: data?.revoked_at ?? null,
  };
}

export async function hasAiConsent(db: SupabaseClient, userId: string): Promise<boolean> {
  try { return (await readAiConsent(db, userId)).granted; } catch { return false; }
}

export class AiConsentRequiredError extends Error {
  constructor() { super(AI_CONSENT_REQUIRED.error); this.name = 'AiConsentRequiredError'; }
}
