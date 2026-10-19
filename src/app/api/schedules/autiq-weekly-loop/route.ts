import { NextResponse } from "next/server";
import { z } from "zod";
import {
  patchSchedule,
  runAutiqWeeklyLoopOnce,
  upsertAutiqWeeklyLoopSchedule,
} from "@/domain/schedules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.enum(["upsert", "request_enable", "run_now"]).default("upsert"),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    if (body.action === "run_now") {
      const task = await runAutiqWeeklyLoopOnce();
      return NextResponse.json({
        task,
        message: "AUTIQ weekly loop task queued — it stops at owner approval before any publish.",
      });
    }
    const { schedule, created } = await upsertAutiqWeeklyLoopSchedule();
    if (body.action === "request_enable" && !schedule.enabled) {
      return NextResponse.json(await patchSchedule(schedule.id, { enabled: true }));
    }
    return NextResponse.json({ schedule, created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AUTIQ weekly loop request failed" },
      { status: 400 },
    );
  }
}
