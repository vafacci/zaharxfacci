import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";
import { createTask } from "@/domain/tasks";
import { createApprovalRequest } from "@/domain/approvals";
import { checkBudget } from "@/domain/budgets";
import {
  AUTIQ_WEEKLY_LOOP_RULE,
  AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
  AUTIQ_WEEKLY_LOOP_TEMPLATE,
} from "@/domain/content-loop";
import {
  DREAMIT_RESEARCH_LOOP_RULE,
  DREAMIT_RESEARCH_LOOP_SCHEDULE_TITLE,
  DREAMIT_RESEARCH_LOOP_TEMPLATE,
  GRUPVI_UX_LOOP_RULE,
  GRUPVI_UX_LOOP_SCHEDULE_TITLE,
  GRUPVI_UX_LOOP_TEMPLATE,
} from "@/domain/project-loops";

export const ScheduleRuleSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^(every_\d+[mh]|daily_\d{2}:\d{2})$/i,
    "Rule must be every_Nm / every_Nh or daily_HH:MM",
  );

export const ScheduleActionTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(4000),
  origin: z.enum(["operational", "validation"]).optional(),
});

export const CreateScheduleInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  rule: ScheduleRuleSchema,
  enabled: z.boolean().default(false),
  actionTemplate: ScheduleActionTemplateSchema,
  /** M6: default true — enabling requires owner approval once. */
  requiresOwnerApproval: z.boolean().optional(),
  maxFiresPerDay: z.number().int().min(1).max(48).optional(),
});

export const PatchScheduleInputSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  rule: ScheduleRuleSchema.optional(),
  actionTemplate: ScheduleActionTemplateSchema.optional(),
  maxFiresPerDay: z.number().int().min(1).max(48).optional(),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>;
export type PatchScheduleInput = z.infer<typeof PatchScheduleInputSchema>;
export type ScheduleActionTemplate = z.infer<typeof ScheduleActionTemplateSchema>;

export function parseActionTemplate(raw: string | null | undefined): ScheduleActionTemplate | null {
  if (!raw) return null;
  try {
    return ScheduleActionTemplateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Compute next run from rule. Returns null if rule is invalid. */
export function computeNextRunAt(rule: string, from: Date = new Date()): Date | null {
  const every = /^every_(\d+)([mh])$/i.exec(rule.trim());
  if (every) {
    const n = Number(every[1]);
    if (!Number.isFinite(n) || n < 1 || n > 24 * 60) return null;
    const ms = every[2].toLowerCase() === "h" ? n * 3_600_000 : n * 60_000;
    return new Date(from.getTime() + ms);
  }
  const daily = /^daily_(\d{2}):(\d{2})$/i.exec(rule.trim());
  if (daily) {
    const hh = Number(daily[1]);
    const mm = Number(daily[2]);
    if (hh > 23 || mm > 59) return null;
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }
  return null;
}

export type ScheduleMutationResult = {
  schedule: Awaited<ReturnType<typeof listSchedules>>[number] | Awaited<
    ReturnType<typeof prisma.schedule.create>
  >;
  pendingApprovalId?: string;
  message?: string;
};

async function requestEnableApproval(scheduleId: string, projectId: string) {
  const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
  const existingPending = await prisma.approval.findFirst({
    where: {
      state: "pending",
      actionType: "enable_recurring_job",
      payloadJson: { contains: scheduleId },
    },
  });
  if (existingPending) return existingPending;

  const task = await createTask({
    projectId,
    title: `Approve recurring job: ${schedule.title}`,
    objective: `Owner approval requested to enable bounded recurring schedule "${schedule.title}" (rule ${schedule.rule}, max ${schedule.maxFiresPerDay}/day). Enabling will enqueue future tasks; publish/merge remain separately gated.`,
    origin: "operational",
    idempotencyKey: `enable-schedule-${schedule.id}-${Date.now()}`,
  });
  // Keep the approval task from being executed as normal work
  await prisma.task.update({
    where: { id: task.id },
    data: { status: "waiting_approval" },
  });
  await prisma.taskRun.updateMany({
    where: { taskId: task.id },
    data: { status: "waiting_approval" },
  });
  const approval = await createApprovalRequest({
    taskId: task.id,
    actionType: "enable_recurring_job",
    actionSummary: `Enable bounded recurring schedule: ${schedule.title}`,
    riskLevel: "medium",
    payload: {
      action: "enable_recurring_job",
      scheduleId: schedule.id,
      projectId,
      rule: schedule.rule,
      maxFiresPerDay: schedule.maxFiresPerDay,
      title: schedule.title,
    },
  });
  return approval;
}

export async function createSchedule(raw: CreateScheduleInput) {
  const input = CreateScheduleInputSchema.parse(raw);
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error("Project not found");

  const requiresOwnerApproval = input.requiresOwnerApproval ?? true;
  const wantsEnable = input.enabled === true;
  const canAutoEnable = wantsEnable && (!requiresOwnerApproval || input.actionTemplate.origin === "validation");

  const schedule = await prisma.schedule.create({
    data: {
      projectId: project.id,
      title: input.title,
      rule: input.rule,
      enabled: canAutoEnable,
      nextRunAt: canAutoEnable ? computeNextRunAt(input.rule) : null,
      actionTemplate: JSON.stringify(input.actionTemplate),
      requiresOwnerApproval,
      ownerApprovedAt: canAutoEnable ? new Date() : null,
      maxFiresPerDay: input.maxFiresPerDay ?? 8,
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  await recordAudit({
    projectId: project.id,
    actor: "Human Owner",
    verb: "schedule.created",
    target: schedule.id,
    payload: {
      title: schedule.title,
      rule: schedule.rule,
      enabled: schedule.enabled,
      requiresOwnerApproval,
    },
  });

  if (wantsEnable && !canAutoEnable) {
    const approval = await requestEnableApproval(schedule.id, project.id);
    return {
      schedule,
      pendingApprovalId: approval.id,
      message: "Recurring job created disabled — awaiting owner approval to enable.",
    } satisfies ScheduleMutationResult;
  }

  return { schedule } satisfies ScheduleMutationResult;
}

export async function patchSchedule(id: string, raw: PatchScheduleInput) {
  const input = PatchScheduleInputSchema.parse(raw);
  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
  if (!existing) throw new Error("Schedule not found");

  const rule = input.rule ?? existing.rule;
  let actionTemplate = existing.actionTemplate;
  if (input.actionTemplate) {
    actionTemplate = JSON.stringify(input.actionTemplate);
  }

  const newlyEnabled = input.enabled === true && !existing.enabled;
  if (newlyEnabled && existing.requiresOwnerApproval && !existing.ownerApprovedAt) {
    // Apply non-enable fields first; keep disabled
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        title: input.title ?? existing.title,
        rule,
        actionTemplate,
        maxFiresPerDay: input.maxFiresPerDay ?? existing.maxFiresPerDay,
        enabled: false,
      },
      include: { project: { select: { id: true, name: true, slug: true } } },
    });
    const approval = await requestEnableApproval(schedule.id, schedule.projectId);
    return {
      schedule,
      pendingApprovalId: approval.id,
      message: "Enable requires owner approval (M6 bounded recurring jobs).",
    } satisfies ScheduleMutationResult;
  }

  const enabled = input.enabled ?? existing.enabled;
  const ruleChanged = Boolean(input.rule && input.rule !== existing.rule);
  let nextRunAt: Date | null = null;
  if (enabled) {
    if (newlyEnabled || ruleChanged) {
      nextRunAt = computeNextRunAt(rule, new Date());
    } else if (existing.nextRunAt && existing.nextRunAt.getTime() > Date.now()) {
      nextRunAt = existing.nextRunAt;
    } else {
      nextRunAt = computeNextRunAt(rule, new Date());
    }
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      rule,
      enabled,
      nextRunAt,
      actionTemplate,
      maxFiresPerDay: input.maxFiresPerDay ?? existing.maxFiresPerDay,
      ownerApprovedAt:
        newlyEnabled && !existing.ownerApprovedAt ? new Date() : existing.ownerApprovedAt,
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  await recordAudit({
    projectId: schedule.projectId,
    actor: "Human Owner",
    verb: "schedule.updated",
    target: schedule.id,
    payload: { enabled: schedule.enabled, rule: schedule.rule },
  });

  return { schedule } satisfies ScheduleMutationResult;
}

/** Called when owner approves enable_recurring_job. */
export async function applyRecurringJobApproval(scheduleId: string) {
  const existing = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!existing) throw new Error("Schedule not found");
  const nextRunAt = computeNextRunAt(existing.rule, new Date());
  const schedule = await prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      enabled: true,
      ownerApprovedAt: new Date(),
      nextRunAt,
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
  await recordAudit({
    projectId: schedule.projectId,
    actor: "Human Owner",
    verb: "schedule.enabled_after_approval",
    target: schedule.id,
    payload: { nextRunAt: nextRunAt?.toISOString() ?? null },
  });
  return schedule;
}

/**
 * Create or refresh the AUTIQ weekly content loop schedule. Never enables it:
 * enabling goes through patchSchedule → enable_recurring_job owner approval.
 */
export async function upsertAutiqWeeklyLoopSchedule() {
  const project = await prisma.project.findUnique({ where: { slug: "autiq" } });
  if (!project) throw new Error("AUTIQ project not found");
  const existing = await prisma.schedule.findFirst({
    where: { projectId: project.id, title: AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
  const actionTemplate = JSON.stringify(AUTIQ_WEEKLY_LOOP_TEMPLATE);
  if (existing) {
    if (existing.actionTemplate === actionTemplate && existing.rule === AUTIQ_WEEKLY_LOOP_RULE) {
      return { schedule: existing, created: false };
    }
    const schedule = await prisma.schedule.update({
      where: { id: existing.id },
      data: { actionTemplate, rule: AUTIQ_WEEKLY_LOOP_RULE },
      include: { project: { select: { id: true, name: true, slug: true } } },
    });
    return { schedule, created: false };
  }
  const { schedule } = await createSchedule({
    projectId: project.id,
    title: AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
    rule: AUTIQ_WEEKLY_LOOP_RULE,
    enabled: false,
    actionTemplate: AUTIQ_WEEKLY_LOOP_TEMPLATE,
    requiresOwnerApproval: true,
    maxFiresPerDay: 1,
  });
  return { schedule, created: true };
}

/** Owner-initiated single run of the loop (each click queues a new task). */
export async function runAutiqWeeklyLoopOnce(now: Date = new Date()) {
  const { schedule } = await upsertAutiqWeeklyLoopSchedule();
  return createTask({
    projectId: schedule.projectId,
    title: AUTIQ_WEEKLY_LOOP_TEMPLATE.title,
    objective: `${AUTIQ_WEEKLY_LOOP_TEMPLATE.objective}\n\n(Owner-started run of: ${schedule.title})`,
    origin: "operational",
    idempotencyKey: `autiq-weekly-loop-manual-${now.toISOString()}`,
  });
}

async function upsertProjectLoopSchedule(params: {
  projectSlug: string;
  title: string;
  rule: string;
  template: { title: string; objective: string; origin: "operational" };
}) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } });
  if (!project) throw new Error(`Project not found: ${params.projectSlug}`);
  const existing = await prisma.schedule.findFirst({
    where: { projectId: project.id, title: params.title },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
  const actionTemplate = JSON.stringify(params.template);
  if (existing) {
    if (existing.actionTemplate === actionTemplate && existing.rule === params.rule) {
      return { schedule: existing, created: false };
    }
    const schedule = await prisma.schedule.update({
      where: { id: existing.id },
      data: { actionTemplate, rule: params.rule },
      include: { project: { select: { id: true, name: true, slug: true } } },
    });
    return { schedule, created: false };
  }
  const { schedule } = await createSchedule({
    projectId: project.id,
    title: params.title,
    rule: params.rule,
    enabled: false,
    actionTemplate: params.template,
    requiresOwnerApproval: true,
    maxFiresPerDay: 1,
  });
  return { schedule, created: true };
}

export async function upsertGrupviUxLoopSchedule() {
  return upsertProjectLoopSchedule({
    projectSlug: "grupvi",
    title: GRUPVI_UX_LOOP_SCHEDULE_TITLE,
    rule: GRUPVI_UX_LOOP_RULE,
    template: GRUPVI_UX_LOOP_TEMPLATE,
  });
}

export async function runGrupviUxLoopOnce(now: Date = new Date()) {
  const { schedule } = await upsertGrupviUxLoopSchedule();
  return createTask({
    projectId: schedule.projectId,
    title: GRUPVI_UX_LOOP_TEMPLATE.title,
    objective: `${GRUPVI_UX_LOOP_TEMPLATE.objective}\n\n(Owner-started run of: ${schedule.title})`,
    origin: "operational",
    idempotencyKey: `grupvi-ux-loop-manual-${now.toISOString()}`,
  });
}

export async function upsertDreamitResearchLoopSchedule() {
  return upsertProjectLoopSchedule({
    projectSlug: "dreamit",
    title: DREAMIT_RESEARCH_LOOP_SCHEDULE_TITLE,
    rule: DREAMIT_RESEARCH_LOOP_RULE,
    template: DREAMIT_RESEARCH_LOOP_TEMPLATE,
  });
}

export async function runDreamitResearchLoopOnce(now: Date = new Date()) {
  const { schedule } = await upsertDreamitResearchLoopSchedule();
  return createTask({
    projectId: schedule.projectId,
    title: DREAMIT_RESEARCH_LOOP_TEMPLATE.title,
    objective: `${DREAMIT_RESEARCH_LOOP_TEMPLATE.objective}\n\n(Owner-started run of: ${schedule.title})`,
    origin: "operational",
    idempotencyKey: `dreamit-research-loop-manual-${now.toISOString()}`,
  });
}

/** Idempotency key for one due fire slot (stable across worker restarts). */
export function scheduleFireIdempotencyKey(scheduleId: string, dueAt: Date): string {
  return `schedule-${scheduleId}-${dueAt.toISOString()}`;
}

export async function listSchedules(projectId?: string) {
  return prisma.schedule.findMany({
    where: projectId ? { projectId } : undefined,
    include: { project: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }],
  });
}

export type ProcessDueResult = {
  /** Task ids created in this call (excludes idempotent replays). */
  createdTaskIds: string[];
  /** Task ids returned for due slots (includes idempotent replay of same slot). */
  firedTaskIds: string[];
};

/**
 * Enqueue tasks for due schedules.
 * Idempotent per schedule + due `nextRunAt` slot (safe across worker restarts).
 */
export async function processDueSchedules(now: Date = new Date()): Promise<ProcessDueResult> {
  const due = await prisma.schedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: { project: true },
    take: 20,
  });

  const createdTaskIds: string[] = [];
  const firedTaskIds: string[] = [];

  for (const schedule of due) {
    const template = parseActionTemplate(schedule.actionTemplate);
    if (!template) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          enabled: false,
          nextRunAt: null,
        },
      });
      await recordAudit({
        projectId: schedule.projectId,
        actor: "scheduler",
        verb: "schedule.disabled_invalid_template",
        target: schedule.id,
      });
      continue;
    }

    if (!schedule.nextRunAt) continue;

    // Daily fire bound (M6)
    const dayKey = now.toISOString().slice(0, 10);
    let firesToday = schedule.firesToday;
    if (schedule.firesDayKey !== dayKey) firesToday = 0;
    if (firesToday >= schedule.maxFiresPerDay) {
      const nextRunAt = computeNextRunAt(schedule.rule, now);
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { nextRunAt, firesToday, firesDayKey: dayKey },
      });
      await recordAudit({
        projectId: schedule.projectId,
        actor: "scheduler",
        verb: "schedule.daily_cap_reached",
        target: schedule.id,
        payload: { maxFiresPerDay: schedule.maxFiresPerDay, dayKey },
      });
      continue;
    }

    const budgetGate = await checkBudget({
      organizationId: schedule.project.organizationId,
      projectId: schedule.projectId,
      dimension: "taskCreates",
    });
    if (!budgetGate.allowed) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: new Date(now.getTime() + 30 * 60_000) },
      });
      await recordAudit({
        projectId: schedule.projectId,
        actor: "scheduler",
        verb: "schedule.budget_blocked",
        target: schedule.id,
        payload: { reason: budgetGate.reason },
      });
      continue;
    }

    const dueAt = schedule.nextRunAt;
    const idempotencyKey = scheduleFireIdempotencyKey(schedule.id, dueAt);

    try {
      const existingForSlot = await prisma.task.findUnique({
        where: { idempotencyKey },
      });

      const task = await createTask({
        projectId: schedule.projectId,
        title: template.title,
        objective: `${template.objective}\n\n(Scheduled: ${schedule.title} · rule ${schedule.rule})`,
        origin: template.origin ?? "operational",
        idempotencyKey,
      });

      // createTask consumes taskCreates budget on real inserts only.
      if (!existingForSlot) {
        firesToday += 1;
      }

      // Advance from the due slot; skip any catch-up slots still in the past.
      let nextRunAt = computeNextRunAt(schedule.rule, dueAt);
      while (nextRunAt && nextRunAt.getTime() <= now.getTime()) {
        const advanced = computeNextRunAt(schedule.rule, nextRunAt);
        if (!advanced || advanced.getTime() <= nextRunAt.getTime()) break;
        nextRunAt = advanced;
      }
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastTaskId: task.id,
          nextRunAt,
          firesToday,
          firesDayKey: dayKey,
        },
      });

      await recordAudit({
        projectId: schedule.projectId,
        actor: "scheduler",
        verb: existingForSlot ? "schedule.fire_replay" : "schedule.fired",
        target: schedule.id,
        payload: {
          taskId: task.id,
          dueAt: dueAt.toISOString(),
          nextRunAt: nextRunAt?.toISOString() ?? null,
          idempotent: Boolean(existingForSlot),
        },
      });

      firedTaskIds.push(task.id);
      if (!existingForSlot) createdTaskIds.push(task.id);
    } catch (err) {
      await recordAudit({
        projectId: schedule.projectId,
        actor: "scheduler",
        verb: "schedule.fire_failed",
        target: schedule.id,
        payload: { error: err instanceof Error ? err.message : String(err) },
      });
      // Push nextRun slightly forward to avoid hot-loop on persistent failures
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: new Date(now.getTime() + 5 * 60_000) },
      });
    }
  }

  return { createdTaskIds, firedTaskIds };
}
