import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";
import { resolveTaskOrigin } from "@/domain/routing";
import {
  CreateTaskInputSchema,
  type CreateTaskInput,
} from "@/domain/schemas";
import { checkBudget, consumeBudget } from "@/domain/budgets";
import { ensureFacciWorkerRunning } from "@/domain/runtime-control";

const CANCELLABLE: TaskStatus[] = [
  TaskStatus.draft,
  TaskStatus.queued,
  TaskStatus.planning,
  TaskStatus.waiting_approval,
  TaskStatus.running,
  TaskStatus.verifying,
];

export async function createTask(raw: CreateTaskInput) {
  const input = CreateTaskInputSchema.parse(raw);
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: {
      agents: { where: { role: "manager", status: "active" }, take: 1 },
    },
  });
  if (!project) throw new Error("Project not found");
  const manager = project.agents[0];
  if (!manager) throw new Error("Project has no manager agent");

  if (input.idempotencyKey) {
    const existing = await prisma.task.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const origin = resolveTaskOrigin({
    explicitOrigin: input.origin,
    idempotencyKey: input.idempotencyKey,
    title: input.title,
  });

  // M6: monthly task-create budget (org + project). Skip consume on idempotent replay above.
  const budgetGate = await checkBudget({
    organizationId: project.organizationId,
    projectId: project.id,
    dimension: "taskCreates",
  });
  if (!budgetGate.allowed) {
    throw new Error(budgetGate.reason);
  }

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      assignedAgentId: manager.id,
      title: input.title,
      objective: input.objective,
      origin,
      priority: input.priority ?? 0,
      status: TaskStatus.queued,
      idempotencyKey: input.idempotencyKey,
      runs: {
        create: {
          status: TaskStatus.queued,
          modelProvider: "demo-planner",
          attempt: 1,
        },
      },
    },
    include: { runs: true, project: true, assignedAgent: true },
  });

  await consumeBudget({
    organizationId: project.organizationId,
    projectId: project.id,
    dimension: "taskCreates",
  });

  await recordAudit({
    projectId: project.id,
    actor: "Human Owner",
    verb: "task.created",
    target: task.id,
    payload: { title: task.title, status: task.status, origin: task.origin },
  });

  // Idle workers exit after quiet periods — wake on new work.
  ensureFacciWorkerRunning();

  return task;
}

export async function cancelTask(taskId: string, reason?: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (!CANCELLABLE.includes(task.status)) {
    throw new Error(`Cannot cancel task in status ${task.status}`);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.cancelled, completedAt: new Date() },
  });

  await prisma.taskRun.updateMany({
    where: {
      taskId,
      status: { in: [TaskStatus.queued, TaskStatus.planning, TaskStatus.running, TaskStatus.waiting_approval, TaskStatus.verifying] },
    },
    data: {
      status: TaskStatus.cancelled,
      endedAt: new Date(),
      errorCode: "cancelled",
      errorMessage: reason ?? "Cancelled by owner",
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });

  await recordAudit({
    projectId: task.projectId,
    actor: "Human Owner",
    verb: "task.cancelled",
    target: taskId,
    payload: { reason: reason ?? null },
  });

  return updated;
}

export async function assertTaskBelongsToProject(taskId: string, projectId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.projectId !== projectId) {
    throw new Error("Project isolation: task does not belong to project");
  }
  return task;
}
