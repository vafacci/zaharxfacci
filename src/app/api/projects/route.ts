import { NextResponse } from "next/server";
import { CreateProjectInputSchema } from "@/domain/schemas";
import { createProjectWithTeam } from "@/domain/projects";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      agents: { orderBy: [{ role: "asc" }, { name: "asc" }] },
      goals: true,
      _count: { select: { tasks: true, artifacts: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateProjectInputSchema.parse(body);
    const project = await createProjectWithTeam(input);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
