import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let API proxy calls pass through — they're not page navigations
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const session = req.cookies.get('os_session');
  const isLoginPage = pathname === '/login';

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/','/login','/dashboard/:path'],
};
