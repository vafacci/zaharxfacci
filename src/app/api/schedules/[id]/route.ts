import { NextResponse } from "next/server";
import { PatchScheduleInputSchema, patchSchedule } from "@/domain/schedules";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = PatchScheduleInputSchema.parse(body);
    const result = await patchSchedule(id, input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Patch failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.schedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    await prisma.schedule.delete({ where: { id } });
    await recordAudit({
      projectId: existing.projectId,
      actor: "Human Owner",
      verb: "schedule.deleted",
      target: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 },
    );
  }
}
