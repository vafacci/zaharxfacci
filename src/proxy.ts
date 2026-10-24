import { NextResponse, type NextRequest } from "next/server";
import { PARTNER_COOKIE, gateEnabled, hasAccess } from "@/lib/partner-auth";

/**
 * Låser partner-siden, aftalen og partner-API'et med en fælles adgangskode.
 * Kun aktiv, når PARTNER_ACCESS_CODE er sat.
 */
export async function proxy(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/api/partner/login") return NextResponse.next();

  if (await hasAccess(request.cookies.get(PARTNER_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/partner-login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/partner/:path*", "/api/partner/:path*", "/aftale/:path*"],
};
