import { NextResponse } from "next/server";
import { computeProjectMetrics } from "@/domain/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const metrics = await computeProjectMetrics(projectId);
  return NextResponse.json(metrics);
}
