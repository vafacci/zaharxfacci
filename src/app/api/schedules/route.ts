import { NextResponse } from "next/server";
import {
  CreateScheduleInputSchema,
  createSchedule,
  listSchedules,
} from "@/domain/schedules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const schedules = await listSchedules(projectId);
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateScheduleInputSchema.parse(body);
    const result = await createSchedule(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid schedule" },
      { status: 400 },
    );
  }
}
