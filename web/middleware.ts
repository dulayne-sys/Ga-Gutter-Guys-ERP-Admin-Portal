import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware — runs BEFORE any React code.
 *
 * Strategy: a lightweight `__session` cookie is set by the client after
 * Firebase sign-in and cleared on sign-out.  If the cookie is absent
 * the user is redirected to /login immediately, eliminating the
 * flash-of-unauthenticated-content.
 *
 * This is intentionally a "hint" — the authoritative auth check remains
 * in the client-side AuthGuard component.
 */

const SESSION_COOKIE = "__session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/legal/eula",
  "/legal/privacy-policy",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /web/* routes
  if (!pathname.startsWith("/web")) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Check for session hint cookie
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/web/:path*"],
};
