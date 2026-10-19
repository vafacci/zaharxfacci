import { NextResponse } from "next/server";
import { listBudgets, upsertBudget, UpsertBudgetSchema, currentMonthKey } from "@/domain/budgets";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const org = await prisma.organization.findFirst();
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
  const url = new URL(req.url);
  const monthKey = url.searchParams.get("monthKey") ?? currentMonthKey();
  const budgets = await listBudgets(org.id, monthKey);
  return NextResponse.json({ monthKey, budgets });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
    const input = UpsertBudgetSchema.parse({
      ...body,
      organizationId: body.organizationId ?? org.id,
    });
    const budget = await upsertBudget(input);
    return NextResponse.json({ budget });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Budget upsert failed" },
      { status: 400 },
    );
  }
}
