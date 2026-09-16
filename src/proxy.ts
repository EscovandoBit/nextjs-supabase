import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/shared/config/public-env";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` and it now runs on the
 * Node.js runtime by default. Do not add `export const runtime` here - it
 * throws in a proxy file.
 *
 * This is a UX and token-refresh layer, NOT a security boundary: an attacker
 * talks straight to the Server Action and never passes through here. Real
 * authorization lives in `verifySession()` plus the RLS policies.
 */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export async function proxy(request: NextRequest) {
  const refreshedCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const cookie of cookiesToSet) {
          // Mutate the request too, so Server Components downstream in this
          // same request already see the refreshed token.
          request.cookies.set(cookie.name, cookie.value);
          refreshedCookies.push(cookie);
        }
        Object.assign(cacheHeaders, headers);
      },
    },
  });

  let authenticated = false;
  try {
    const { data } = await supabase.auth.getClaims();
    authenticated = typeof data?.claims.sub === "string";
  } catch {
    // Auth server unreachable. Treat as anonymous rather than 500-ing the app.
    authenticated = false;
  }

  const { pathname } = request.nextUrl;
  const response = decide({ request, pathname, authenticated });

  // Applied to whichever response we return, including redirects - otherwise a
  // redirect would drop the refreshed session cookies and loop.
  for (const { name, value, options } of refreshedCookies) {
    response.cookies.set(name, value, options);
  }
  // Without these, a CDN or shared cache can store a response carrying one
  // user's Set-Cookie and serve it to somebody else.
  for (const [key, value] of Object.entries(cacheHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function decide(input: {
  request: NextRequest;
  pathname: string;
  authenticated: boolean;
}): NextResponse {
  const { request, pathname, authenticated } = input;

  if (!authenticated && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (authenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/todos";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
