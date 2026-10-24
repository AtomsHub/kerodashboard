// src/middleware.ts
// Next.js Edge Middleware for Admin Authentication & Session Enforcement
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & internal routes bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/svg') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has('kero_admin_session') ||
    request.cookies.has('kero_admin_refresh') ||
    request.cookies.has('kero_admin_token');

  const isLoginPage = pathname === '/login';

  // If visitor is unauthenticated and attempting to access any dashboard route, redirect to /login
  if (!hasSession && !isLoginPage) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('returnUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If visitor is already authenticated and attempts to access /login, redirect to dashboard home
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
