import { prisma } from "@/lib/db";
import { recordAudit } from "@/domain/audit";
import {
  CreateProjectInputSchema,
  type CreateProjectInput,
} from "@/domain/schemas";
import { TEMPLATE_LABELS } from "@/agents/templates";

export async function createProjectWithTeam(raw: CreateProjectInput) {
  const input = CreateProjectInputSchema.parse(raw);
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("Organization missing — run seed first");

  const ceo = await prisma.agent.findFirst({
    where: { organizationId: org.id, role: "ceo" },
  });
  if (!ceo) throw new Error("CEO agent missing — run seed first");

  const existing = await prisma.project.findUnique({ where: { slug: input.slug } });
  if (existing) throw new Error(`Project slug already exists: ${input.slug}`);

  const team = input.teamTemplates ?? ["developer", "marketing", "qa"];

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        organizationId: org.id,
        slug: input.slug,
        name: input.name,
        mission: input.mission ?? null,
        status: "active",
      },
    });

    const manager = await tx.agent.create({
      data: {
        organizationId: org.id,
        projectId: p.id,
        parentAgentId: ceo.id,
        name: `${input.name} Manager`,
        role: "manager",
        templateKey: "manager",
        instructions: `Dedicated project manager for ${input.name}. Keep context project-local.`,
        status: "active",
      },
    });

    for (const templateKey of team) {
      const label = TEMPLATE_LABELS[templateKey] ?? templateKey;
      await tx.agent.create({
        data: {
          organizationId: org.id,
          projectId: p.id,
          parentAgentId: manager.id,
          name: `${input.name} ${label} Agent`,
          role: "specialist",
          templateKey,
          instructions: `Project-local ${label} specialist for ${input.name}.`,
          status: "active",
        },
      });
    }

    await tx.projectGoal.create({
      data: {
        projectId: p.id,
        goal: input.mission ?? `Advance ${input.name}`,
        successCriteria: "Measurable, evidence-based task completion",
        priority: 1,
      },
    });

    return p;
  });

  await recordAudit({
    projectId: project.id,
    actor: "Human Owner",
    verb: "project.created",
    target: project.id,
    payload: { slug: project.slug, team },
  });

  return prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: {
      agents: { orderBy: [{ role: "asc" }, { name: "asc" }] },
      goals: true,
    },
  });
}
