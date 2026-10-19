import { PrismaClient } from "@prisma/client";
import { SEED_PROJECTS, SEED_TOOLS, TEMPLATE_LABELS } from "../src/agents/templates";
import {
  AUTIQ_WEEKLY_LOOP_RULE,
  AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
  AUTIQ_WEEKLY_LOOP_TEMPLATE,
} from "../src/domain/content-loop";

const prisma = new PrismaClient();

async function main() {
  await prisma.taskStep.deleteMany();
  await prisma.taskRun.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.agentToolPermission.deleteMany();
  await prisma.projectGoal.deleteMany();
  await prisma.projectMemory.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.monthlyBudget.deleteMany();
  await prisma.ownerMemory.deleteMany();
  await prisma.project.deleteMany();
  await prisma.toolRegistration.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "FACCI",
      ownerName: "Human Owner",
    },
  });

  const ceo = await prisma.agent.create({
    data: {
      organizationId: org.id,
      projectId: null,
      parentAgentId: null,
      name: "FACCI CEO",
      role: "ceo",
      templateKey: "ceo",
      instructions:
        "Cross-project CEO. Prioritize and delegate to project managers. Never bypass approvals.",
      status: "active",
    },
  });

  for (const seed of SEED_PROJECTS) {
    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        slug: seed.slug,
        name: seed.name,
        mission: seed.mission,
        status: "active",
        priority: seed.slug === "autiq" ? 1 : 0,
      },
    });

    const manager = await prisma.agent.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
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
      await prisma.agent.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          parentAgentId: manager.id,
          name: `${seed.name.split(" / ")[0]} ${label} Agent`,
          role: "specialist",
          templateKey,
          instructions: `Project-local ${label} agent for ${seed.name}. Isolated memory and permissions.`,
          status: "active",
        },
      });
    }

    await prisma.projectGoal.create({
      data: {
        projectId: project.id,
        goal: seed.mission,
        successCriteria: "Evidence-backed completed tasks with artifacts or explicit blockers",
        priority: 1,
      },
    });

    // M5: disabled example schedules (owner must enable)
    if (seed.slug === "autiq") {
      await prisma.schedule.create({
        data: {
          projectId: project.id,
          title: AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
          rule: AUTIQ_WEEKLY_LOOP_RULE,
          enabled: false,
          nextRunAt: null,
          requiresOwnerApproval: true,
          maxFiresPerDay: 1,
          actionTemplate: JSON.stringify(AUTIQ_WEEKLY_LOOP_TEMPLATE),
        },
      });
    }
    if (seed.slug === "grupvi") {
      await prisma.schedule.create({
        data: {
          projectId: project.id,
          title: "Weekly Grupvi UX review",
          rule: "daily_09:00",
          enabled: false,
          nextRunAt: null,
          actionTemplate: JSON.stringify({
            title: "Improve Grupvi chat UX review",
            objective:
              "Produce a UX review of the StudieChat/Grupvi chat experience: clarity, friction, and proposed acceptance criteria. Do not invent user interviews. Cite provenance.",
            origin: "operational",
          }),
        },
      });
    }
    if (seed.slug === "dreamit") {
      await prisma.schedule.create({
        data: {
          projectId: project.id,
          title: "DreamIT research sweep",
          rule: "every_24h",
          enabled: false,
          nextRunAt: null,
          actionTemplate: JSON.stringify({
            title: "Find problems we should fix in DreamIT",
            objective:
              "Research brief: list candidate product problems and priorities with verified sources only. No invented customer data.",
            origin: "operational",
          }),
        },
      });
    }
  }

  for (const tool of SEED_TOOLS) {
    await prisma.toolRegistration.create({
      data: {
        adapterType: tool.adapterType,
        name: tool.name,
        state: tool.state,
        capabilityJson: JSON.stringify({ m1: true }),
      },
    });
  }

  // M6: org-wide monthly budget defaults (local counters, not cloud invoices)
  const monthKey = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  await prisma.monthlyBudget.create({
    data: {
      organizationId: org.id,
      projectId: "",
      monthKey,
      maxPlanCalls: 500,
      maxImageGens: 80,
      maxTaskCreates: 800,
      remoteModelConsent: false,
      remoteModelMaxCalls: 0,
      notes: "M6 seed defaults — owner may tighten via /api/budgets",
    },
  });

  await prisma.ownerMemory.create({
    data: {
      organizationId: org.id,
      category: "portfolio_priority",
      content:
        "Default preference: prioritize AUTIQ content reliability, then Grupvi UX, then DreamIT research. Observed seed preference — edit via /api/memories.",
      sourceRef: "seed",
      lastVerifiedAt: new Date(),
    },
  });

  // Demo-labeled note so UI can show seed is intentional demo data
  await prisma.auditEvent.create({
    data: {
      actor: "system",
      verb: "seed.completed",
      target: org.id,
      payloadRedacted: JSON.stringify({
        label: "DEMO SEED DATA",
        projects: SEED_PROJECTS.map((p) => p.slug),
      }),
    },
  });

  console.log(
    "Seeded FACCI organization with AUTIQ, Grupvi, DreamIT, NOFACCI, DailyCap (+ M6 budgets/memory).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
