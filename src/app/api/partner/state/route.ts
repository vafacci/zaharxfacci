import { NextResponse, type NextRequest } from "next/server";
import { failure, guard, noStore } from "@/lib/partner-api";
import { loadKv, parseItem, saveItems } from "@/lib/partner-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ kv: await loadKv() }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

/** Gemmer kun de nøgler, der er ændret. Body: { items: [{ key, value }] } */
export async function PATCH(request: NextRequest) {
  const denied = await guard(request, { write: true });
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const items = body.items.map(parseItem);
    if (items.some((i) => i === null)) {
      return NextResponse.json({ error: "invalid_item" }, { status: 400 });
    }
    await saveItems(items as NonNullable<(typeof items)[number]>[]);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
