import { NextResponse } from "next/server";
import { ApprovalDecisionSchema } from "@/domain/schemas";
import { decideApproval } from "@/domain/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = ApprovalDecisionSchema.parse(body);
    const approval = await decideApproval(id, parsed.decision, parsed.decidedBy);
    return NextResponse.json({ approval });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Decision failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
