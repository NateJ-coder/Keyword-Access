import { NextResponse } from "next/server";

const COOKIE_NAME = "ka_auth";

export async function POST(request: Request) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json({ error: "No access code is configured for this deployment yet." }, { status: 503 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };

  if (!password || password !== sitePassword) {
    return NextResponse.json({ error: "That access code isn't right." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, sitePassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/"
  });

  return response;
}
