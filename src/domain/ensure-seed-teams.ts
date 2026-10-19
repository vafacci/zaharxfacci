/**
 * Non-destructive: create missing SEED_PROJECTS and add missing specialists.
 * Does not wipe tasks, schedules, or memories.
 */
import { prisma } from "@/lib/db";
import { SEED_PROJECTS, TEMPLATE_LABELS } from "@/agents/templates";
import { recordAudit } from "@/domain/audit";

export type EnsureSeedTeamsResult = {
  projectSlug: string;
  createdProject: boolean;
  added: string[];
  alreadyHad: string[];
  missingProject: boolean;
};

export async function ensureSeedTeams(): Promise<EnsureSeedTeamsResult[]> {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("Organization missing — run db:seed first");

  const ceo = await prisma.agent.findFirst({
    where: { organizationId: org.id, role: "ceo" },
  });
  if (!ceo) throw new Error("CEO agent missing — run db:seed first");

  const results: EnsureSeedTeamsResult[] = [];

  for (const seed of SEED_PROJECTS) {
    let project = await prisma.project.findUnique({
      where: { slug: seed.slug },
      include: { agents: true },
    });

    let createdProject = false;

    if (!project) {
      project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({
          data: {
            organizationId: org.id,
            slug: seed.slug,
            name: seed.name,
            mission: seed.mission,
            status: "active",
            priority: seed.slug === "autiq" ? 1 : 0,
          },
        });

        const manager = await tx.agent.create({
          data: {
            organizationId: org.id,
            projectId: p.id,
            parentAgentId: ceo.id,
            name: seed.manager,
            role: "manager",
            templateKey: "manager",
            instructions: `Dedicated manager for ${seed.name}. Own project context and specialist team.`,
            status: "active",
          },
        });

        for (const templateKey of seed.team) {
          const label = TEMPLATE_LABELS[templateKey] ?? templateKey;
          const shortName = seed.name.split(" / ")[0];
          await tx.agent.create({
            data: {
              organizationId: org.id,
              projectId: p.id,
              parentAgentId: manager.id,
              name: `${shortName} ${label} Agent`,
              role: "specialist",
              templateKey,
              instructions: `Project-local ${label} agent for ${seed.name}. Isolated memory and permissions.`,
              status: "active",
            },
          });
        }

        await tx.projectGoal.create({
          data: {
            projectId: p.id,
            goal: seed.mission,
            successCriteria:
              "Evidence-backed completed tasks with artifacts or explicit blockers",
            priority: 1,
          },
        });

        return tx.project.findUniqueOrThrow({
          where: { id: p.id },
          include: { agents: true },
        });
      });

      createdProject = true;
      await recordAudit({
        projectId: project.id,
        actor: "system",
        verb: "project.ensured",
        target: project.id,
        payload: { slug: seed.slug, team: [...seed.team] },
      });

      results.push({
        projectSlug: seed.slug,
        createdProject: true,
        added: [...seed.team],
        alreadyHad: [],
        missingProject: false,
      });
      continue;
    }

    const manager =
      project.agents.find((a) => a.role === "manager") ??
      (await prisma.agent.findFirst({
        where: { projectId: project.id, role: "manager" },
      }));

    if (!manager) {
      throw new Error(`Manager missing for project ${seed.slug}`);
    }

    const existingKeys = new Set(
      project.agents
        .filter((a) => a.role === "specialist")
        .map((a) => a.templateKey),
    );

    const added: string[] = [];
    const alreadyHad: string[] = [];

    for (const templateKey of seed.team) {
      if (existingKeys.has(templateKey)) {
        alreadyHad.push(templateKey);
        continue;
      }
      const label = TEMPLATE_LABELS[templateKey] ?? templateKey;
      const shortName = seed.name.split(" / ")[0];
      await prisma.agent.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          parentAgentId: manager.id,
          name: `${shortName} ${label} Agent`,
          role: "specialist",
          templateKey,
          instructions: `Project-local ${label} agent for ${seed.name}. Isolated memory and permissions.`,
          status: "active",
        },
      });
      added.push(templateKey);
      existingKeys.add(templateKey);
    }

    if (added.length) {
      await recordAudit({
        projectId: project.id,
        actor: "system",
        verb: "team.specialists_ensured",
        target: project.id,
        payload: { slug: seed.slug, added },
      });
    }

    results.push({
      projectSlug: seed.slug,
      createdProject,
      added,
      alreadyHad,
      missingProject: false,
    });
  }

  return results;
}
