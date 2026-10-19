import { NextResponse } from "next/server";
import { z } from "zod";
import {
  patchSchedule,
  runDreamitResearchLoopOnce,
  runGrupviUxLoopOnce,
  upsertDreamitResearchLoopSchedule,
  upsertGrupviUxLoopSchedule,
} from "@/domain/schedules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  project: z.enum(["grupvi", "dreamit"]),
  action: z.enum(["upsert", "request_enable", "run_now"]).default("upsert"),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    if (body.project === "grupvi") {
      if (body.action === "run_now") {
        const task = await runGrupviUxLoopOnce();
        return NextResponse.json({
          task,
          message: "Grupvi UX loop queued — drafts only, no store/deploy.",
        });
      }
      const { schedule, created } = await upsertGrupviUxLoopSchedule();
      if (body.action === "request_enable" && !schedule.enabled) {
        return NextResponse.json(await patchSchedule(schedule.id, { enabled: true }));
      }
      return NextResponse.json({ schedule, created });
    }

    if (body.action === "run_now") {
      const task = await runDreamitResearchLoopOnce();
      return NextResponse.json({
        task,
        message: "DreamIT research loop queued — no invented metrics, no outreach.",
      });
    }
    const { schedule, created } = await upsertDreamitResearchLoopSchedule();
    if (body.action === "request_enable" && !schedule.enabled) {
      return NextResponse.json(await patchSchedule(schedule.id, { enabled: true }));
    }
    return NextResponse.json({ schedule, created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Project loop request failed" },
      { status: 400 },
    );
  }
}
