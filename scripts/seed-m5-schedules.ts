import { prisma } from "../src/lib/db";

async function main() {
  const specs = [
    {
      slug: "grupvi",
      title: "Weekly Grupvi UX review",
      rule: "daily_09:00",
      actionTemplate: {
        title: "Improve Grupvi chat UX review",
        objective:
          "Produce a UX review of the StudieChat/Grupvi chat experience: clarity, friction, and proposed acceptance criteria. Do not invent user interviews. Cite provenance.",
        origin: "operational" as const,
      },
    },
    {
      slug: "dreamit",
      title: "DreamIT research sweep",
      rule: "every_24h",
      actionTemplate: {
        title: "Find problems we should fix in DreamIT",
        objective:
          "Research brief: list candidate product problems and priorities with verified sources only. No invented customer data.",
        origin: "operational" as const,
      },
    },
  ];

  for (const spec of specs) {
    const p = await prisma.project.findUnique({ where: { slug: spec.slug } });
    if (!p) {
      console.log("skip missing project", spec.slug);
      continue;
    }
    const existing = await prisma.schedule.findFirst({
      where: { projectId: p.id, title: spec.title },
    });
    if (existing) {
      console.log("exists", spec.title);
      continue;
    }
    await prisma.schedule.create({
      data: {
        projectId: p.id,
        title: spec.title,
        rule: spec.rule,
        enabled: false,
        actionTemplate: JSON.stringify(spec.actionTemplate),
      },
    });
    console.log("created", spec.title);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
