import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { env, siteUrl } from "@/lib/env";
import { canAccessDashboard } from "@/modules/auth/roles";
import { getStaffSession, loginUrl } from "@/modules/auth/session";

const CSP_HEADER = "Content-Security-Policy";

// Runs before every matched request (Node runtime in Next 16):
// 1. A fresh nonce + CSP per request. Next reads the nonce from the *request*
//    CSP header while rendering and applies it to its own scripts; layouts
//    pass it on via `x-nonce` (next-themes).
// 2. The whole dashboard is staff-only: signed-out or non-staff visitors go to
//    the central login (auth.aboutselphy.com), which returns them here. This is
//    only the first gate: pages, route handlers and every Server Action check
//    again (src/modules/auth/guards.ts), since prefetches skip the proxy.
// Static security headers (HSTS, nosniff, ...) live in next.config.ts.
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce, new URL(env().AUTH_URL).origin);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const session = await getStaffSession(request.cookies);
  let response: NextResponse;
  if (!session || !canAccessDashboard(session.user.role)) {
    const { pathname, search } = request.nextUrl;
    // Return URL from the public site URL, not request.url (the container's
    // internal address behind Traefik).
    response = NextResponse.redirect(loginUrl(`${siteUrl()}${pathname}${search}`));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except API routes (they authorize themselves; /api/health
      // must stay open for Docker), Next internals and files with an
      // extension. No backslashes in here: the production build once turned
      // `\\.` into a plain "." and the CSP silently vanished from every page.
      // Use a character class ([.]) and re-check the CSP header on a
      // production build after ANY matcher change.
      source: "/((?!api|_next|_vercel|.*[.].*).*)",
      // next/link prefetches don't render HTML, so they don't need a CSP.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
