import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";

export type BudgetDimension = "planCalls" | "imageGens" | "taskCreates" | "remoteCalls";

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const UpsertBudgetSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().optional(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  maxPlanCalls: z.number().int().min(0).max(100_000).optional(),
  maxImageGens: z.number().int().min(0).max(10_000).optional(),
  maxTaskCreates: z.number().int().min(0).max(100_000).optional(),
  remoteModelConsent: z.boolean().optional(),
  remoteModelMaxCalls: z.number().int().min(0).max(10_000).optional(),
  notes: z.string().max(2000).optional(),
});

export async function ensureMonthlyBudget(params: {
  organizationId: string;
  projectId?: string | null;
  monthKey?: string;
}) {
  const monthKey = params.monthKey ?? currentMonthKey();
  const projectId = params.projectId ?? "";
  return prisma.monthlyBudget.upsert({
    where: {
      organizationId_projectId_monthKey: {
        organizationId: params.organizationId,
        projectId,
        monthKey,
      },
    },
    create: {
      organizationId: params.organizationId,
      projectId,
      monthKey,
    },
    update: {},
  });
}

export async function listBudgets(organizationId: string, monthKey?: string) {
  const key = monthKey ?? currentMonthKey();
  await ensureMonthlyBudget({ organizationId, projectId: "", monthKey: key });
  return prisma.monthlyBudget.findMany({
    where: { organizationId, monthKey: key },
    orderBy: { projectId: "asc" },
  });
}

export async function upsertBudget(raw: z.infer<typeof UpsertBudgetSchema>) {
  const input = UpsertBudgetSchema.parse(raw);
  const monthKey = input.monthKey ?? currentMonthKey();
  const projectId = input.projectId ?? "";
  const budget = await prisma.monthlyBudget.upsert({
    where: {
      organizationId_projectId_monthKey: {
        organizationId: input.organizationId,
        projectId,
        monthKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      projectId,
      monthKey,
      maxPlanCalls: input.maxPlanCalls ?? 200,
      maxImageGens: input.maxImageGens ?? 40,
      maxTaskCreates: input.maxTaskCreates ?? 300,
      remoteModelConsent: input.remoteModelConsent ?? false,
      remoteModelMaxCalls: input.remoteModelMaxCalls ?? 0,
      notes: input.notes,
    },
    update: {
      maxPlanCalls: input.maxPlanCalls,
      maxImageGens: input.maxImageGens,
      maxTaskCreates: input.maxTaskCreates,
      remoteModelConsent: input.remoteModelConsent,
      remoteModelMaxCalls: input.remoteModelMaxCalls,
      notes: input.notes,
    },
  });
  await recordAudit({
    actor: "Human Owner",
    verb: "budget.upserted",
    target: budget.id,
    payload: { monthKey, projectId, remoteModelConsent: budget.remoteModelConsent },
  });
  return budget;
}

export type BudgetGateResult =
  | { allowed: true; org: Awaited<ReturnType<typeof ensureMonthlyBudget>>; project: Awaited<ReturnType<typeof ensureMonthlyBudget>> | null }
  | { allowed: false; reason: string; dimension: BudgetDimension };

function remaining(
  used: number,
  max: number,
): number {
  return Math.max(0, max - used);
}

/**
 * Check org + optional project ceilings. Fail closed when any applicable ceiling is exhausted.
 */
export async function checkBudget(params: {
  organizationId: string;
  projectId?: string | null;
  dimension: BudgetDimension;
}): Promise<BudgetGateResult> {
  const monthKey = currentMonthKey();
  const org = await ensureMonthlyBudget({
    organizationId: params.organizationId,
    projectId: "",
    monthKey,
  });
  const project = params.projectId
    ? await ensureMonthlyBudget({
        organizationId: params.organizationId,
        projectId: params.projectId,
        monthKey,
      })
    : null;

  const dim = params.dimension;
  const pairs: Array<{ label: string; used: number; max: number }> = [];
  if (dim === "planCalls") {
    pairs.push({ label: "org", used: org.usedPlanCalls, max: org.maxPlanCalls });
    if (project) pairs.push({ label: "project", used: project.usedPlanCalls, max: project.maxPlanCalls });
  } else if (dim === "imageGens") {
    pairs.push({ label: "org", used: org.usedImageGens, max: org.maxImageGens });
    if (project) pairs.push({ label: "project", used: project.usedImageGens, max: project.maxImageGens });
  } else if (dim === "taskCreates") {
    pairs.push({ label: "org", used: org.usedTaskCreates, max: org.maxTaskCreates });
    if (project) pairs.push({ label: "project", used: project.usedTaskCreates, max: project.maxTaskCreates });
  } else {
    pairs.push({ label: "org", used: org.usedRemoteCalls, max: org.remoteModelMaxCalls });
    if (project) {
      pairs.push({
        label: "project",
        used: project.usedRemoteCalls,
        max: project.remoteModelMaxCalls,
      });
    }
  }

  for (const p of pairs) {
    if (remaining(p.used, p.max) <= 0) {
      return {
        allowed: false,
        dimension: dim,
        reason: `Monthly budget exhausted for ${dim} (${p.label} ${p.used}/${p.max}, month ${monthKey}).`,
      };
    }
  }

  if (dim === "remoteCalls") {
    const consent = org.remoteModelConsent || project?.remoteModelConsent;
    if (!consent) {
      return {
        allowed: false,
        dimension: dim,
        reason: "Remote model use blocked — owner consent not granted for this month.",
      };
    }
  }

  return { allowed: true, org, project };
}

export async function consumeBudget(params: {
  organizationId: string;
  projectId?: string | null;
  dimension: BudgetDimension;
  amount?: number;
}): Promise<BudgetGateResult> {
  const gate = await checkBudget(params);
  if (!gate.allowed) return gate;
  const amount = params.amount ?? 1;
  const monthKey = currentMonthKey();
  const field =
    params.dimension === "planCalls"
      ? "usedPlanCalls"
      : params.dimension === "imageGens"
        ? "usedImageGens"
        : params.dimension === "taskCreates"
          ? "usedTaskCreates"
          : "usedRemoteCalls";

  await prisma.monthlyBudget.update({
    where: { id: gate.org.id },
    data: { [field]: { increment: amount } },
  });
  if (params.projectId && gate.project) {
    await prisma.monthlyBudget.update({
      where: { id: gate.project.id },
      data: { [field]: { increment: amount } },
    });
  }

  await recordAudit({
    projectId: params.projectId ?? undefined,
    actor: "budget",
    verb: "budget.consumed",
    target: monthKey,
    payload: { dimension: params.dimension, amount, organizationId: params.organizationId },
  });

  return gate;
}
