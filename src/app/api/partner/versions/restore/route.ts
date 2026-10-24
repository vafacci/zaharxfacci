import { NextResponse, type NextRequest } from "next/server";
import { failure, guard, noStore } from "@/lib/partner-api";
import { restoreVersion } from "@/lib/partner-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gendan en gemt version. Nuværende stilling gemmes først automatisk. Body: { id: number } */
export async function POST(request: NextRequest) {
  const denied = await guard(request, { write: true });
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const restored = await restoreVersion(id);
    if (!restored) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, label: restored.label }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
