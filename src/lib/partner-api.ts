import { NextResponse } from "next/server";
import { hasAccess, PARTNER_COOKIE } from "@/lib/partner-auth";
import { NotConfiguredError } from "@/lib/partner-db";

/** Sikrer adgang (cookie) og JSON ved skrivning. Returnerer et svar, hvis forespørgslen skal afvises. */
export async function guard(
  request: Request & { cookies: { get(name: string): { value: string } | undefined } },
  opts: { write?: boolean } = {},
): Promise<NextResponse | null> {
  if (!(await hasAccess(request.cookies.get(PARTNER_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (opts.write && !(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "bad_request" }, { status: 415 });
  }
  return null;
}

export function failure(error: unknown): NextResponse {
  if (error instanceof NotConfiguredError) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  console.error("partner-api", error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

export const noStore = { "Cache-Control": "no-store" };
