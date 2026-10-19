import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { artifactsRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

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

  const ext = path.extname(abs).toLowerCase();
  const mime =
    MIME[ext] ??
    (() => {
      try {
        const meta = artifact.metadataJson
          ? (JSON.parse(artifact.metadataJson) as { mimeType?: string })
          : {};
        return meta.mimeType ?? "application/octet-stream";
      } catch {
        return "application/octet-stream";
      }
    })();

  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=60",
      "Content-Length": String(buf.length),
    },
  });
}
