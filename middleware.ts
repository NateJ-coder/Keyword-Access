import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "ka_auth";
const PUBLIC_PATHS = ["/login", "/api/login"];

export function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;

  // No password configured (e.g. local dev) — leave the app open rather
  // than locking developers out by default.
  if (!sitePassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname === path) ||
    pathname === "/fuzio-logo.jpg" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (cookie === sitePassword) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
