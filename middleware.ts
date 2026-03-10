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
