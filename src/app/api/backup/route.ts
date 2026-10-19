import { NextResponse } from "next/server";
import { createSqliteBackup, listBackups } from "@/lib/backup";
import { recordAudit } from "@/domain/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ backups: listBackups() });
}

export async function POST(req: Request) {
  try {
    let label: string | undefined;
    try {
      const body = (await req.json()) as { label?: string };
      label = typeof body.label === "string" ? body.label : undefined;
    } catch {
      // empty body ok
    }
    const result = createSqliteBackup(label ?? "manual");
    await recordAudit({
      actor: "Human Owner",
      verb: "backup.created",
      target: result.relativePath,
      payload: { bytes: result.bytes },
    });
    return NextResponse.json({ backup: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup failed" },
      { status: 500 },
    );
  }
}
