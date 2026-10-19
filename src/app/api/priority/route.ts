import { NextResponse } from "next/server";
import {
  listPortfolioPriorities,
  setProjectPriority,
  SetProjectPrioritySchema,
} from "@/domain/prioritization";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const org = await prisma.organization.findFirst();
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
  const portfolio = await listPortfolioPriorities(org.id);
  return NextResponse.json({ portfolio });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SetProjectPrioritySchema.parse(body);
    const project = await setProjectPriority(input);
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Priority update failed" },
      { status: 400 },
    );
  }
}
