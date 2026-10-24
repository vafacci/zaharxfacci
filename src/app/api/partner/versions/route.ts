import { NextResponse, type NextRequest } from "next/server";
import { failure, guard, noStore } from "@/lib/partner-api";
import { createVersion, listVersions } from "@/lib/partner-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ versions: await listVersions() }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

/** Gem nuværende stilling som version. Body: { label?: string, kind?: "manual" | "auto" } */
export async function POST(request: NextRequest) {
  const denied = await guard(request, { write: true });
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as { label?: unknown; kind?: unknown };
    const label = typeof body.label === "string" ? body.label : "";
    const kind = body.kind === "auto" ? "auto" : "manual";
    const version = await createVersion(label, kind);
    return NextResponse.json({ version }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
