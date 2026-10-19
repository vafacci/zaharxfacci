import { NextResponse } from "next/server";
import {
  listOwnerMemories,
  listProjectMemories,
  upsertOwnerMemory,
  upsertProjectMemory,
  UpsertOwnerMemorySchema,
  UpsertProjectMemorySchema,
} from "@/domain/memory";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const scope = url.searchParams.get("scope") ?? "project";
  if (scope === "owner") {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
    const memories = await listOwnerMemories(org.id);
    return NextResponse.json({ scope: "owner", memories });
  }
  if (!projectId) {
    return NextResponse.json({ error: "projectId required for project scope" }, { status: 400 });
  }
  const memories = await listProjectMemories(projectId);
  return NextResponse.json({ scope: "project", memories });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.scope === "owner" || body.organizationId) {
      const org = await prisma.organization.findFirst();
      if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
      const input = UpsertOwnerMemorySchema.parse({
        ...body,
        organizationId: body.organizationId ?? org.id,
      });
      const memory = await upsertOwnerMemory(input);
      return NextResponse.json({ memory }, { status: 201 });
    }
    const input = UpsertProjectMemorySchema.parse(body);
    const memory = await upsertProjectMemory(input);
    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Memory upsert failed" },
      { status: 400 },
    );
  }
}
