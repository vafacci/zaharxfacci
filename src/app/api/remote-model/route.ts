import { NextResponse } from "next/server";
import { getRemoteModelStatus, tryRemoteCompletion } from "@/providers/remote-model";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ remoteModel: getRemoteModelStatus() });
}

/** Opt-in probe — never used by default worker path. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { projectId?: string; prompt?: string };
    if (!body.projectId || !body.prompt) {
      return NextResponse.json({ error: "projectId and prompt required" }, { status: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const result = await tryRemoteCompletion({
      organizationId: project.organizationId,
      projectId: project.id,
      prompt: body.prompt,
    });
    return NextResponse.json({ result, status: getRemoteModelStatus() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Remote probe failed" },
      { status: 400 },
    );
  }
}
