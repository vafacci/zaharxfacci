import { NextResponse } from "next/server";
import { computeTeamPerformance, persistTeamPerformance } from "@/domain/team-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const windowDays = Number(url.searchParams.get("windowDays") ?? "30");
  const report = await computeTeamPerformance(
    projectId,
    Number.isFinite(windowDays) ? windowDays : 30,
  );
  return NextResponse.json({ report });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { projectId?: string; windowDays?: number };
    if (!body.projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }
    const result = await persistTeamPerformance(body.projectId, body.windowDays ?? 30);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Performance persist failed" },
      { status: 400 },
    );
  }
}
