import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

const PUBLIC_PATHS = new Set(["/login", "/setup"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Route handlers enforce the session themselves and must return JSON 401s,
  // not an HTML redirect to /login.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = verifySessionToken(token);

  if (!authenticated && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    return NextResponse.redirect(url);
  }

  // Do not redirect authenticated tokens away from /login here. The token can
  // be signature-valid but belong to an older session version after a PIN
  // change; redirectIfAuthenticated() checks that against the database.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
