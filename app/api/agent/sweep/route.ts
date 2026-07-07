// GET /api/agent/sweep — the "watch it think" live investigation.
// Streams one NDJSON event per step as the agent works through the real scans:
// holdings → concentration → sector tilt → tax-loss harvest → earnings exposure
// → thesis cross-check → findings. Cookie-authenticated so every self-clienting
// scan fn runs under the signed-in user's RLS session. First streaming route in
// the app; keep it on the Node runtime (DB + in-memory caches, not Edge).

import { createClient } from '@/lib/supabase/server';
import { getPortfolioSummary } from '@/lib/portfolio-analysis';
import { generateTaxReport } from '@/lib/tax-analysis';
import { generateEarningsReport } from '@/lib/earnings-analysis';
import { generateThesisActions } from '@/lib/thesis-actions';
import { hasThesisAccess } from '@/lib/thesis-access-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fmtUsd = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const uid = user.id;
  const canThesis = await hasThesisAccess(uid, user.email);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let findings = 0;
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      // A small pace so cached scans still read as deliberate work, not a flash.
      const pace = (ms = 380) => new Promise((r) => setTimeout(r, ms));

      // Each step: announce running, do the work, announce the result. A throw
      // downgrades that one step to "skipped" and the sweep continues.
      const step = async (
        id: string,
        label: string,
        work: () => Promise<{ detail: string; found?: number }>,
      ) => {
        send({ type: 'step', id, label, status: 'running' });
        await pace();
        try {
          const { detail, found = 0 } = await work();
          findings += found;
          send({ type: 'step', id, status: 'done', detail, found });
        } catch {
          send({ type: 'step', id, status: 'skipped', detail: 'could not complete' });
        }
      };

      try {
        // 1. Holdings — the base read every other step leans on.
        const summary = await getPortfolioSummary(uid);
        if (summary.positionCount === 0) {
          send({ type: 'step', id: 'holdings', label: 'Reading your holdings', status: 'done', detail: 'no positions yet — connect an account to run a full sweep' });
          send({ type: 'done', findings: 0, headline: 'Nothing to sweep yet. Connect an account and I will get to work.' });
          controller.close();
          return;
        }
        send({ type: 'step', id: 'holdings', label: 'Reading your holdings', status: 'running' });
        await pace(300);
        send({ type: 'step', id: 'holdings', status: 'done', detail: `${summary.positionCount} positions · ${fmtUsd(summary.totalValue)}` });

        // 2. Concentration.
        await step('concentration', 'Checking single-name concentration', async () => {
          const alerts = summary.concentrationAlerts;
          if (alerts.length === 0) return { detail: 'no position over your weight limit' };
          const top = alerts[0];
          return { detail: `${alerts.length} flagged · ${top.ticker} at ${top.allocationPct.toFixed(1)}%`, found: alerts.length };
        });

        // 3. Sector tilt (from the summary — no extra market calls).
        await step('sector', 'Mapping sector tilt', async () => {
          const top = [...summary.sectorExposure].sort((a, b) => b.allocationPct - a.allocationPct)[0];
          if (!top) return { detail: 'no sector data' };
          return { detail: `heaviest in ${top.sector} at ${top.allocationPct.toFixed(0)}%` };
        });

        // 4. Tax-loss harvest.
        await step('tax', 'Scanning for tax-loss harvests', async () => {
          const tax = await generateTaxReport(uid);
          if (tax.opportunityCount === 0) return { detail: 'no harvestable losses in taxable accounts' };
          return { detail: `${tax.opportunityCount} harvestable · ${fmtUsd(tax.totalEstimatedSavings)} est. savings`, found: tax.opportunityCount };
        });

        // 5. Earnings exposure.
        await step('earnings', 'Checking earnings exposure', async () => {
          const er = await generateEarningsReport(uid);
          if (er.upcoming.length === 0) return { detail: 'no earnings in your book this window' };
          return { detail: `${er.upcoming.length} upcoming · ${fmtUsd(er.totalUpcomingExposure)} exposed`, found: er.upcoming.length };
        });

        // 6. Thesis cross-check (Max — reasons vs fresh evidence).
        if (canThesis) {
          await step('thesis', 'Cross-checking your theses', async () => {
            const { actions } = await generateThesisActions(supabase, uid);
            if (actions.length === 0) return { detail: 'every tracked thesis still holds' };
            return { detail: `${actions.length} action${actions.length === 1 ? '' : 's'} on weakening reasons`, found: actions.length };
          });
        } else {
          send({ type: 'step', id: 'thesis', label: 'Cross-checking your theses', status: 'skipped', detail: 'Max feature' });
        }

        await pace(250);
        const headline = findings === 0
          ? 'Swept your book. Nothing needs your attention right now.'
          : `Swept your book. ${findings} thing${findings === 1 ? '' : 's'} worth a look.`;
        send({ type: 'done', findings, headline });
      } catch {
        send({ type: 'error', message: 'The sweep hit an error partway through.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
