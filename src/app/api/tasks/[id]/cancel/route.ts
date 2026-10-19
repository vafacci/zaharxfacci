import { NextResponse } from "next/server";
import { CancelTaskSchema } from "@/domain/schemas";
import { cancelTask } from "@/domain/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = CancelTaskSchema.parse(body);
    const task = await cancelTask(id, parsed.reason);
    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
