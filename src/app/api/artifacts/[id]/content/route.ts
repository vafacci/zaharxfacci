import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { artifactsRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const artifact = await prisma.artifact.findUnique({ where: { id } });
  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relative = artifact.storageRef
    .replace(/^data[\\/]+artifacts[\\/]+/i, "")
    .replace(/\\/g, "/");
  const abs = path.join(artifactsRoot(), ...relative.split("/").filter(Boolean));
  const root = path.resolve(artifactsRoot());
  if (!path.resolve(abs).startsWith(root)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
  const content = fs.readFileSync(abs, "utf8");
  return NextResponse.json({
    id: artifact.id,
    title: artifact.title,
    kind: artifact.kind,
    storageRef: artifact.storageRef,
    content,
  });
}
