import { ApprovalState, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";
import { hashPayload } from "@/tools/policy";

export async function createApprovalRequest(params: {
  taskId: string;
  requestedByAgentId?: string | null;
  actionType: string;
  actionSummary: string;
  riskLevel: string;
  payload: unknown;
  expiresInHours?: number;
}) {
  const payloadHash = hashPayload(params.payload);
  const expiresAt = new Date(
    Date.now() + (params.expiresInHours ?? 24) * 60 * 60 * 1000,
  );

  const approval = await prisma.approval.create({
    data: {
      taskId: params.taskId,
      requestedByAgentId: params.requestedByAgentId ?? null,
      actionType: params.actionType,
      actionSummary: params.actionSummary,
      riskLevel: params.riskLevel,
      payloadJson: JSON.stringify(params.payload),
      payloadHash,
      state: ApprovalState.pending,
      expiresAt,
    },
  });

  await prisma.task.update({
    where: { id: params.taskId },
    data: { status: TaskStatus.waiting_approval },
  });

  await recordAudit({
    actor: params.requestedByAgentId ?? "system",
    verb: "approval.requested",
    target: approval.id,
    payload: {
      actionType: params.actionType,
      riskLevel: params.riskLevel,
      payloadHash,
    },
  });

  return approval;
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: { task: true },
  });
  if (!approval) throw new Error("Approval not found");
  if (approval.state !== ApprovalState.pending) {
    throw new Error(`Approval already ${approval.state}`);
  }
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    await prisma.approval.update({
      where: { id: approvalId },
      data: { state: ApprovalState.expired, decidedAt: new Date() },
    });
    await prisma.task.update({
      where: { id: approval.taskId },
      data: { status: TaskStatus.blocked },
    });
    throw new Error("Approval expired");
  }

  const currentHash = hashPayload(JSON.parse(approval.payloadJson));
  if (currentHash !== approval.payloadHash) {
    throw new Error("Payload hash mismatch — approval invalidated");
  }

  const updated = await prisma.approval.update({
    where: { id: approvalId },
    data: {
      state:
        decision === "approved" ? ApprovalState.approved : ApprovalState.rejected,
      approvedBy: decidedBy,
      decidedAt: new Date(),
    },
  });

  // M6: enabling a bounded recurring job IS the approved side effect (local only).
  if (decision === "approved" && approval.actionType === "enable_recurring_job") {
    const payload = JSON.parse(approval.payloadJson) as { scheduleId?: string };
    if (!payload.scheduleId) throw new Error("enable_recurring_job missing scheduleId");
    const { applyRecurringJobApproval } = await import("@/domain/schedules");
    await applyRecurringJobApproval(payload.scheduleId);
    await prisma.task.update({
      where: { id: approval.taskId },
      data: { status: TaskStatus.completed, completedAt: new Date() },
    });
    await prisma.taskRun.updateMany({
      where: { taskId: approval.taskId, status: { not: TaskStatus.cancelled } },
      data: {
        status: TaskStatus.completed,
        endedAt: new Date(),
        errorCode: null,
        errorMessage: "Recurring job enabled after owner approval (M6).",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    await recordAudit({
      projectId: approval.task.projectId,
      actor: decidedBy,
      verb: "approval.approved",
      target: approvalId,
      payload: {
        actionType: approval.actionType,
        executionState: "recurring_job_enabled",
        scheduleId: payload.scheduleId,
      },
    });
    return updated;
  }

  // Even if approved, never auto-execute merge/push/publish/deploy (M3 policy).
  if (decision === "approved") {
    await prisma.task.update({
      where: { id: approval.taskId },
      data: {
        status: TaskStatus.blocked,
        completedAt: new Date(),
      },
    });
    await prisma.taskRun.updateMany({
      where: { taskId: approval.taskId, status: { not: TaskStatus.cancelled } },
      data: {
        status: TaskStatus.blocked,
        endedAt: new Date(),
        errorCode: "external_execution_disabled",
        errorMessage:
          "Approval recorded (granted). Merge/push/publish/deploy were NOT executed — gated execution is disabled until a later milestone.",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  } else {
    await prisma.task.update({
      where: { id: approval.taskId },
      data: { status: TaskStatus.blocked, completedAt: new Date() },
    });
    await prisma.taskRun.updateMany({
      where: { taskId: approval.taskId, status: { not: TaskStatus.cancelled } },
      data: {
        status: TaskStatus.blocked,
        endedAt: new Date(),
        errorCode: "approval_rejected",
        errorMessage: "Owner rejected the proposed action — nothing was executed.",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  }

  await recordAudit({
    projectId: approval.task.projectId,
    actor: decidedBy,
    verb: decision === "approved" ? "approval.approved" : "approval.rejected",
    target: approvalId,
    payload: {
      actionType: approval.actionType,
      executionState:
        decision === "approved" ? "approved_not_executed" : "rejected_not_executed",
      note:
        decision === "approved"
          ? "Approved but external side effects not executed (M3 policy)"
          : "Rejected — no execution",
    },
  });

  return updated;
}
