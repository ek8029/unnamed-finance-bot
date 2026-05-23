import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateDigest, generateGenericDigest } from '@/lib/generate-digest';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/digest
 *
 * Called by daily cron. For each user whose preferred delivery hour matches
 * the current hour (ET), generates an AI digest and stores it.
 * Users without a preference default to 9 AM ET (14:00 UTC).
 *
 * Optimization: users without holdings share a single generic digest
 * (one OpenAI call instead of N).
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Current hour in ET
    const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
    const currentHourET = parseInt(nowET.split(', ')[1].split(':')[0], 10);
    log.push(`[digest] Current hour ET: ${currentHourET}`);

    // Get all users with their preferences
    const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Get all delivery time preferences
    const { data: prefs } = await serviceClient
      .from('user_preferences')
      .select('user_id, brief_delivery_time');

    const prefMap = new Map<string, string>();
    for (const p of prefs ?? []) {
      if (p.brief_delivery_time) prefMap.set(p.user_id, p.brief_delivery_time);
    }

    // Get today's already-generated digests
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: existingDigests } = await serviceClient
      .from('brief_digests')
      .select('user_id, generated_at')
      .gte('generated_at', todayStart.toISOString());

    const alreadyGenerated = new Set((existingDigests ?? []).map(d => d.user_id));

    const forceAll = new URL(request.url).searchParams.get('force') === 'true';

    // Get all holdings in one query
    const { data: allHoldings } = await serviceClient
      .from('holdings')
      .select('user_id, ticker');

    const holdingsMap = new Map<string, string[]>();
    for (const h of allHoldings ?? []) {
      const existing = holdingsMap.get(h.user_id) || [];
      existing.push(h.ticker.toUpperCase());
      holdingsMap.set(h.user_id, existing);
    }

    // Split users into eligible list
    interface EligibleUser {
      id: string;
      email: string;
      firstName: string;
      tickers: string[];
    }

    const eligible: EligibleUser[] = [];
    let skipped = 0;

    for (const user of users) {
      if (!user.email) continue;
      if (alreadyGenerated.has(user.id)) { skipped++; continue; }

      const deliveryTime = prefMap.get(user.id);
      let preferredHour = 9;
      if (deliveryTime) {
        preferredHour = parseInt(deliveryTime.split(':')[0], 10);
      }
      if (!forceAll && currentHourET !== preferredHour) { skipped++; continue; }

      const tickers = [...new Set(holdingsMap.get(user.id) || [])];
      const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there';
      eligible.push({ id: user.id, email: user.email, firstName, tickers });
    }

    log.push(`[digest] ${eligible.length} eligible, ${skipped} skipped`);

    // Generate generic digest ONCE for all users without holdings
    const usersWithHoldings = eligible.filter(u => u.tickers.length > 0);
    const usersWithoutHoldings = eligible.filter(u => u.tickers.length === 0);

    let generated = 0;

    // Handle users without holdings — one OpenAI call, bulk upsert
    if (usersWithoutHoldings.length > 0) {
      try {
        const genericResult = await generateGenericDigest();
        const now = new Date().toISOString();

        // Bulk upsert all generic digest users
        const rows = usersWithoutHoldings.map(u => ({
          user_id: u.id,
          digest: genericResult.digest,
          holdings: genericResult.holdings,
          generated_at: now,
        }));

        await serviceClient
          .from('brief_digests')
          .upsert(rows, { onConflict: 'user_id' });

        generated += usersWithoutHoldings.length;
        log.push(`[digest] Generic digest → ${usersWithoutHoldings.length} users (${genericResult.tokens} tokens)`);

        // Email all generic digest users in parallel (batches of 5)
        if (resend) {
          await sendDigestEmails(usersWithoutHoldings, genericResult.digest, log);
        }
      } catch (err) {
        log.push(`[digest] Generic digest failed: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // Handle users WITH holdings — parallel batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < usersWithHoldings.length; i += BATCH_SIZE) {
      const batch = usersWithHoldings.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const result = await generateDigest(user.tickers);
          await serviceClient
            .from('brief_digests')
            .upsert({
              user_id: user.id,
              digest: result.digest,
              holdings: result.holdings,
              generated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (resend) {
            await sendDigestEmail(user, result.digest, log);
          }

          log.push(`[digest] Generated for ${user.email.slice(0, 4)}... (${result.tokens} tokens, ${user.tickers.length} holdings)`);
          return result;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') generated++;
        else log.push(`[digest] Batch item failed: ${r.reason instanceof Error ? r.reason.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped,
      current_hour_et: currentHourET,
      duration_ms: Date.now() - startTime,
      log,
    });
  } catch (error) {
    console.error('[cron/digest] Fatal error:', error);
    return NextResponse.json({ error: 'Digest cron failed' }, { status: 500 });
  }
}

async function sendDigestEmail(
  user: { email: string; firstName: string },
  digest: string,
  log: string[],
) {
  if (!resend) return;
  try {
    const briefUrl = 'https://helmterminal.dev/dashboard/brief';
    const digestPreview = digest.split('\n\n')[0].slice(0, 200);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: 'Your morning brief is ready — The Current',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body bgcolor="#FFFFFF" style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF"><tr><td align="center" valign="top" style="padding:40px 16px 48px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:500px;"><tr><td><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#1E1E1E" style="background:#1E1E1E;border-radius:8px;"><tr><td height="2" bgcolor="#E6B94D" style="height:2px;line-height:2px;font-size:0;background:#E6B94D;border-radius:8px 8px 0 0;">&nbsp;</td></tr><tr><td bgcolor="#1E1E1E" style="padding:36px 40px 16px;"><p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#E6B94D;font-family:monospace;">The Current</p></td></tr><tr><td bgcolor="#1E1E1E" style="padding:0 40px 24px;"><h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#FAFAFA;line-height:1.3;">Good morning, ${user.firstName}.</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#8F8F8F;font-family:Georgia,'Times New Roman',serif;">${digestPreview}...</p><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#E6B94D" style="border-radius:6px;"><a href="${briefUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#0A0A0A;text-decoration:none;letter-spacing:0.02em;">Read full brief →</a></td></tr></table></td></tr><tr><td bgcolor="#1E1E1E" style="padding:0 40px 24px;"><p style="margin:0;font-size:10px;color:#525252;">AI-generated summary. Not financial advice.</p></td></tr></table></td></tr><tr><td style="padding:16px 0 0;text-align:center;"><p style="margin:0;font-size:10px;color:#8A8A8A;">Helm Terminal · <a href="https://helmterminal.dev" style="color:#8A8A8A;">helmterminal.dev</a></p></td></tr></table></td></tr></table></body></html>`,
      text: `Good morning, ${user.firstName}.\n\n${digestPreview}...\n\nRead your full brief: ${briefUrl}\n\n— Helm Terminal`,
    });
    log.push(`[digest] Emailed ${user.email.slice(0, 4)}...`);
  } catch (emailErr) {
    log.push(`[digest] Email failed ${user.email.slice(0, 4)}...: ${emailErr instanceof Error ? emailErr.message : 'unknown'}`);
  }
}

async function sendDigestEmails(
  users: { email: string; firstName: string }[],
  digest: string,
  log: string[],
) {
  const BATCH_SIZE = 5;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(user => sendDigestEmail(user, digest, log))
    );
  }
}
