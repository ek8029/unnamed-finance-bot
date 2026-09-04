/**
 * Persist a failed figure check so the rate is measurable.
 *
 * console.warn told nobody anything: this exists so "what is the invention rate
 * on /analyze this week" has an answer with a number in it. Written only when a
 * check fails, so a clean week costs nothing.
 *
 * Never blocks and never throws. A logging table that can break a page view is
 * worse than no logging table.
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { NumberCheck } from '@/lib/number-verify';

export function logFigureCheck(input: {
  surface: 'analyze' | 'research_chat';
  check: NumberCheck;
  ref?: string | null;
  userId?: string | null;
  model?: string | null;
}): void {
  if (input.check.ok) return;
  void (async () => {
    try {
      const db = await createServiceClient();
      await db.from('ai_figure_checks').insert({
        surface: input.surface,
        ref: input.ref ?? null,
        user_id: input.userId ?? null,
        model: input.model ?? null,
        figures_checked: input.check.checked,
        unverified_count: input.check.unverified.length,
        unverified: input.check.nearest,
      });
    } catch {
      // Migration 069 not applied, or a transient failure. The console.warn at
      // the call site is still the record.
    }
  })();
}
