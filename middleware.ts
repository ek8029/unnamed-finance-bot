import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Check MFA assurance level
  let needsMFA = false;
  if (user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMFA = aalData?.nextLevel === 'aal2' && aalData?.currentLevel === 'aal1';
  }

  const pathname = request.nextUrl.pathname;

  // MFA verification page
  if (pathname === '/mfa-verify') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!needsMFA) {
      // Already verified or no MFA required
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard'];
  const isProtectedPath = protectedPaths.some(path =>
    pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedPath && user && needsMFA) {
    // Authenticated but MFA not yet verified this session
    return NextResponse.redirect(new URL('/mfa-verify', request.url));
  }

  // Auth pages - redirect to dashboard if already fully authenticated
  const authPaths = ['/login', '/signup', '/forgot-password'];
  const isAuthPath = authPaths.some(path =>
    pathname === path
  );

  if (isAuthPath && user && !needsMFA) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isAuthPath && user && needsMFA) {
    // User has session but needs MFA - redirect to MFA verify page
    return NextResponse.redirect(new URL('/mfa-verify', request.url));
  }

  // ── /analyze/[ticker] Cache-Control override ──
  //
  // Next.js defaults dynamic routes to `Cache-Control: private, no-store`.
  // The /analyze/[ticker] pages are PUBLIC — every visitor sees the same
  // AI analysis for a given ticker — and we want Google/Vercel edge to
  // cache them for 30 min (matching analysis_cache market-hours TTL) with
  // a 24h stale-while-revalidate window.
  //
  // We tried `export const revalidate = 1800` on the page itself but
  // something in the analyzeStock code graph (likely a transitive no-store
  // fetch or cookies() call) keeps Next marking the route dynamic, which
  // overrides route-segment config. Setting the header here in middleware
  // runs AFTER Next's own header emission and reliably wins.
  //
  // Matches /analyze/AAPL but not /analyze (index page, already static) or
  // /analyze/AAPL/summary (future, different caching policy may apply).
  // Only set public cache headers for anonymous visitors — authenticated users
  // get a different layout (dashboard sidebar) so the response must not be
  // shared across users by the CDN.
  if (/^\/analyze\/[A-Za-z]{1,5}$/.test(pathname) && !user) {
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=86400',
    );
  }

  // ── Security headers ──
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://plausible.io https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://assets.apollo.io`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.polygon.io https://plausible.io https://cdn.plaid.com https://*.plaid.com https://api.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://assets.apollo.io https://app.apollo.io",
      "frame-src https://cdn.plaid.com https://*.plaid.com https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
