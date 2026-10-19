import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";

export const UpsertProjectMemorySchema = z.object({
  projectId: z.string().min(1),
  category: z.string().min(1).max(64),
  content: z.string().min(1).max(8000),
  sourceRef: z.string().max(200).optional(),
  verify: z.boolean().optional(),
});

export const UpsertOwnerMemorySchema = z.object({
  organizationId: z.string().min(1),
  category: z.string().min(1).max(64),
  content: z.string().min(1).max(8000),
  sourceRef: z.string().max(200).optional(),
  verify: z.boolean().optional(),
});

export async function listProjectMemories(projectId: string, take = 40) {
  return prisma.projectMemory.findMany({
    where: { projectId },
    orderBy: [{ lastVerifiedAt: "desc" }, { updatedAt: "desc" }],
    take,
  });
}

export async function listOwnerMemories(organizationId: string, take = 40) {
  return prisma.ownerMemory.findMany({
    where: { organizationId },
    orderBy: [{ lastVerifiedAt: "desc" }, { updatedAt: "desc" }],
    take,
  });
}

export async function upsertProjectMemory(raw: z.infer<typeof UpsertProjectMemorySchema>) {
  const input = UpsertProjectMemorySchema.parse(raw);
  const existing = input.sourceRef
    ? await prisma.projectMemory.findFirst({
        where: { projectId: input.projectId, category: input.category, sourceRef: input.sourceRef },
      })
    : null;

  const data = {
    content: input.content.slice(0, 8000),
    lastVerifiedAt: input.verify === false ? null : new Date(),
    sourceRef: input.sourceRef,
  };

  const row = existing
    ? await prisma.projectMemory.update({ where: { id: existing.id }, data })
    : await prisma.projectMemory.create({
        data: {
          projectId: input.projectId,
          category: input.category,
          ...data,
        },
      });

  await recordAudit({
    projectId: input.projectId,
    actor: "memory",
    verb: existing ? "memory.project_updated" : "memory.project_created",
    target: row.id,
    payload: { category: input.category, sourceRef: input.sourceRef ?? null },
  });
  return row;
}

export async function upsertOwnerMemory(raw: z.infer<typeof UpsertOwnerMemorySchema>) {
  const input = UpsertOwnerMemorySchema.parse(raw);
  const existing = input.sourceRef
    ? await prisma.ownerMemory.findFirst({
        where: {
          organizationId: input.organizationId,
          category: input.category,
          sourceRef: input.sourceRef,
        },
      })
    : null;

  const data = {
    content: input.content.slice(0, 8000),
    lastVerifiedAt: input.verify === false ? null : new Date(),
    sourceRef: input.sourceRef,
  };

  const row = existing
    ? await prisma.ownerMemory.update({ where: { id: existing.id }, data })
    : await prisma.ownerMemory.create({
        data: {
          organizationId: input.organizationId,
          category: input.category,
          ...data,
        },
      });

  await recordAudit({
    actor: "Human Owner",
    verb: existing ? "memory.owner_updated" : "memory.owner_created",
    target: row.id,
    payload: { category: input.category },
  });
  return row;
}

/**
 * Persist a durable outcome memory from a completed task (evidence-backed, project-scoped).
 */
export async function consolidateTaskOutcome(params: {
  projectId: string;
  taskId: string;
  title: string;
  status: string;
  specialistKey?: string | null;
  artifactKinds?: string[];
  modelId?: string | null;
  errorMessage?: string | null;
}) {
  const lines = [
    `Task ${params.taskId}: ${params.title}`,
    `Status: ${params.status} (observed)`,
    params.specialistKey ? `Specialist: ${params.specialistKey}` : null,
    params.modelId ? `Model: ${params.modelId}` : null,
    params.artifactKinds?.length
      ? `Artifacts: ${params.artifactKinds.join(", ")}`
      : "Artifacts: none",
    params.errorMessage ? `Error: ${params.errorMessage.slice(0, 400)}` : null,
    "Provenance: observed from FACCI task/run/artifact records — not inferred business outcomes.",
  ]
    .filter(Boolean)
    .join("\n");

  return upsertProjectMemory({
    projectId: params.projectId,
    category: "task_outcome",
    content: lines,
    sourceRef: params.taskId,
    verify: true,
  });
}

/** Memories for planner context: verified first, capped. */
export async function memoriesForPlanning(projectId: string, take = 16) {
  const rows = await listProjectMemories(projectId, take);
  return rows.map((m) => ({
    category: m.category,
    content: m.content.slice(0, 600),
    verified: Boolean(m.lastVerifiedAt),
  }));
}
