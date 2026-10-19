import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";

export const SetProjectPrioritySchema = z.object({
  projectId: z.string().min(1),
  priority: z.number().int().min(0).max(100),
});

export async function setProjectPriority(raw: z.infer<typeof SetProjectPrioritySchema>) {
  const input = SetProjectPrioritySchema.parse(raw);
  const project = await prisma.project.update({
    where: { id: input.projectId },
    data: { priority: input.priority },
  });
  await recordAudit({
    projectId: project.id,
    actor: "Human Owner",
    verb: "project.priority_set",
    target: project.id,
    payload: { priority: project.priority },
  });
  return project;
}

export async function listPortfolioPriorities(organizationId: string) {
  const projects = await prisma.project.findMany({
    where: { organizationId },
    select: {
      id: true,
      slug: true,
      name: true,
      priority: true,
      status: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  const queued = await prisma.task.groupBy({
    by: ["projectId"],
    where: {
      status: "queued",
      project: { organizationId },
    },
    _count: { _all: true },
  });
  const queuedMap = new Map(queued.map((q) => [q.projectId, q._count._all]));

  return projects.map((p) => ({
    ...p,
    queuedTasks: queuedMap.get(p.id) ?? 0,
  }));
}

/**
 * Rank candidate task-run ids for worker claim.
 * Higher project.priority, then task.priority, then older createdAt.
 */
export async function selectNextQueuedRunId(): Promise<string | null> {
  const candidates = await prisma.taskRun.findMany({
    where: {
      status: "queued",
      task: { status: "queued" },
    },
    select: {
      id: true,
      createdAt: true,
      task: {
        select: {
          priority: true,
          project: { select: { priority: true } },
        },
      },
    },
    take: 50,
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const pp = b.task.project.priority - a.task.project.priority;
    if (pp !== 0) return pp;
    const tp = b.task.priority - a.task.priority;
    if (tp !== 0) return tp;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return candidates[0]?.id ?? null;
}
