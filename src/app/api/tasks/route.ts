import { NextResponse } from "next/server";
import { CreateTaskInputSchema } from "@/domain/schemas";
import { createTask } from "@/domain/tasks";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const tasks = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    include: {
      project: true,
      assignedAgent: true,
      artifacts: true,
      approvals: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateTaskInputSchema.parse(body);
    const task = await createTask(input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
