// Server-side thesis entitlement. The thesis + agentic layer is a Pro feature,
// with an email allowlist kept as a backstop so the founder and comped beta testers
// retain access regardless of their billing tier. Used by the gated /api/thesis
// routes (hard 403) and by the thesis additions on brief/earnings/insights/taxes.
//
// This file is server-only (it imports the tier lookup, which hits Supabase). Client
// surfaces use the isThesisUser allowlist + useTier() instead — never import this.
import { isThesisUser } from '@/lib/thesis-access';
import { requirePro } from '@/lib/tier';

export async function hasThesisAccess(userId: string, email?: string | null): Promise<boolean> {
  if (isThesisUser(email)) return true;
  const { allowed } = await requirePro(userId);
  return allowed;
}
