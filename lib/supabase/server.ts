/**
 * Supabase Server Client
 *
 * This client is used in Server Components, Server Actions, and API Routes.
 * It properly handles cookie-based authentication with Next.js.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

/**
 * Dev-only lab impersonation: with the `helm_lab_email` cookie set (picked in
 * /testing/app), every server component and API route resolves auth to that
 * account and reads run under the service role — so the REAL dashboard renders
 * any user's book on localhost, pixel-identical, no login.
 *
 * Safety:
 *  - Hard NODE_ENV gate: dead code on any production build (Vercel previews
 *    included). The cookie is only ever written by the dev-only lab shell.
 *  - READ-ONLY: insert/update/upsert/delete throw loudly. Browsing another
 *    user's real rows is a preview; writing to them is never acceptable.
 */
async function createImpersonatedClient(email: string): Promise<SupabaseClient | null> {
  const svc = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: profile } = await svc
    .from('user_profiles')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (!profile) return null;

  const user = {
    id: String(profile.id),
    email: String(profile.email),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
  } as User;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Pure telemetry the product writes as a side effect of normal browsing
  // (e.g. the chat records a usage row per question). Blocking these would 500
  // the surfaces being previewed, so they no-op silently instead — nothing a
  // user would recognise as their data.
  const TELEMETRY_TABLES = new Set(['analysis_usage']);

  const client = svc as any;
  const origFrom = client.from.bind(client);
  client.from = (table: string) => {
    const qb = origFrom(table);
    for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
      qb[m] = () => {
        if (m === 'insert' && TELEMETRY_TABLES.has(table)) {
          return Promise.resolve({ data: null, error: null });
        }
        throw new Error(`[lab] impersonation is read-only: ${m} on ${table} blocked`);
      };
    }
    return qb;
  };
  client.auth.getUser = async () => ({ data: { user }, error: null });
  // supabase-js sends the session's access_token as the Authorization header on
  // every PostgREST request, so this MUST be a real JWT — the service key keeps
  // reads on service-role access. ('lab' here = "Expected 3 parts in JWT" on
  // every query, tier silently falling back to free.)
  client.auth.getSession = async () => ({
    data: {
      session: { user, access_token: process.env.SUPABASE_SERVICE_ROLE_KEY!, token_type: 'bearer' },
    },
    error: null,
  });
  if (client.auth.mfa) {
    client.auth.mfa.getAuthenticatorAssuranceLevel = async () => ({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return client as SupabaseClient;
}

export async function createClient() {
  const cookieStore = await cookies();

  // Dev-only lab impersonation (see above). Falls through to the real session
  // client when the cookie is absent or the email resolves to no account.
  if (process.env.NODE_ENV !== 'production') {
    const labEmail = cookieStore.get('helm_lab_email')?.value;
    if (labEmail) {
      const impersonated = await createImpersonatedClient(decodeURIComponent(labEmail));
      if (impersonated) return impersonated;
    }
  }

  /**
   * Native clients (the iOS app) cannot participate in Next's cookie session,
   * so they present the Supabase access token as a Bearer instead. Every API
   * route already goes through this function, so they all gain it at once and
   * none of them need to know which kind of client is calling.
   *
   * This grants NO extra privilege. It uses the ANON key, so RLS applies
   * exactly as it does on the web: the JWT *is* the identity, an expired or
   * forged one resolves to no user, and auth.getUser() still validates the
   * token against Supabase rather than trusting its claims.
   */
  const authHeader = (await headers()).get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Service role client for admin operations.
 * Uses createClient from @supabase/supabase-js directly (no cookie dependency)
 * so it truly bypasses RLS and works in all server contexts (webhooks, cron, etc.).
 * CAUTION: This bypasses RLS policies. Only use in secure server-side contexts.
 */
export async function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Cookie-free service client for public read-only queries.
 * Does NOT call cookies() so pages using it can be statically generated / ISR.
 * Use for homepage data fetches, public API routes, etc.
 */
export function createStaticServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );
}
