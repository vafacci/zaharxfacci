import { NextResponse, type NextRequest } from "next/server";
import {
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
  codeMatches,
  gateEnabled,
  safeNextPath,
  sessionToken,
} from "@/lib/partner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.json({ ok: true, next: "/partner" });

  const body = (await request.json().catch(() => null)) as { code?: unknown; next?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const token = await sessionToken();

  if (!token || !code || !(await codeMatches(code))) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: "wrong_code" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    next: safeNextPath(typeof body?.next === "string" ? body.next : null),
  });
  response.cookies.set(PARTNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PARTNER_COOKIE_MAX_AGE,
  });
  return response;
}
