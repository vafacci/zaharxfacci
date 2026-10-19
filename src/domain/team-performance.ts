import { prisma } from "@/lib/db";
import { writeProjectArtifact } from "@/lib/paths";
import { upsertProjectMemory } from "@/domain/memory";
import { createHash } from "crypto";

export type SpecialistPerformance = {
  templateKey: string;
  agentName: string;
  stepsCompleted: number;
  stepsFailed: number;
  tasksTouched: number;
  avgPlanLatencyMs: number | null;
};

export type TeamPerformanceReport = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  generatedAt: string;
  windowDays: number;
  tasks: {
    total: number;
    completed: number;
    failed: number;
    blocked: number;
    cancelled: number;
    operationalCompleted: number;
    validationCompleted: number;
  };
  specialists: SpecialistPerformance[];
  notes: string[];
};

export async function computeTeamPerformance(
  projectId: string,
  windowDays = 30,
): Promise<TeamPerformanceReport> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      agents: { where: { role: "specialist", status: "active" } },
    },
  });
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: { projectId, createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      origin: true,
      runs: {
        select: {
          planLatencyMs: true,
          modelId: true,
          steps: {
            select: {
              status: true,
              agentId: true,
              agent: { select: { templateKey: true, name: true } },
            },
          },
        },
        orderBy: { attempt: "desc" },
        take: 1,
      },
    },
  });

  const byStatus = {
    total: tasks.length,
    completed: 0,
    failed: 0,
    blocked: 0,
    cancelled: 0,
    operationalCompleted: 0,
    validationCompleted: 0,
  };
  for (const t of tasks) {
    if (t.status === "completed") {
      byStatus.completed += 1;
      if (t.origin === "validation") byStatus.validationCompleted += 1;
      else byStatus.operationalCompleted += 1;
    } else if (t.status === "failed") byStatus.failed += 1;
    else if (t.status === "blocked") byStatus.blocked += 1;
    else if (t.status === "cancelled") byStatus.cancelled += 1;
  }

  type Acc = {
    templateKey: string;
    agentName: string;
    stepsCompleted: number;
    stepsFailed: number;
    taskIds: Set<string>;
    latencies: number[];
  };
  const map = new Map<string, Acc>();
  for (const a of project.agents) {
    map.set(a.templateKey, {
      templateKey: a.templateKey,
      agentName: a.name,
      stepsCompleted: 0,
      stepsFailed: 0,
      taskIds: new Set(),
      latencies: [],
    });
  }

  for (const t of tasks) {
    const run = t.runs[0];
    if (!run) continue;
    if (typeof run.planLatencyMs === "number") {
      // attribute latency to specialists who acted on the run
    }
    for (const step of run.steps) {
      const key = step.agent?.templateKey;
      if (!key) continue;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          templateKey: key,
          agentName: step.agent?.name ?? key,
          stepsCompleted: 0,
          stepsFailed: 0,
          taskIds: new Set(),
          latencies: [],
        };
        map.set(key, acc);
      }
      acc.taskIds.add(t.id);
      if (step.status === "completed") acc.stepsCompleted += 1;
      if (step.status === "failed") acc.stepsFailed += 1;
      if (typeof run.planLatencyMs === "number") acc.latencies.push(run.planLatencyMs);
    }
  }

  const specialists: SpecialistPerformance[] = [...map.values()].map((a) => ({
    templateKey: a.templateKey,
    agentName: a.agentName,
    stepsCompleted: a.stepsCompleted,
    stepsFailed: a.stepsFailed,
    tasksTouched: a.taskIds.size,
    avgPlanLatencyMs:
      a.latencies.length > 0
        ? Math.round(a.latencies.reduce((x, y) => x + y, 0) / a.latencies.length)
        : null,
  }));

  return {
    projectId: project.id,
    projectSlug: project.slug,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    windowDays,
    tasks: byStatus,
    specialists: specialists.sort((a, b) => b.stepsCompleted - a.stepsCompleted),
    notes: [
      "All figures are observed from FACCI task/run/step rows in the selected window.",
      "Validation harness tasks are counted separately from operational completions.",
      "This is not a human HR review and does not invent customer impact.",
    ],
  };
}

export async function persistTeamPerformance(projectId: string, windowDays = 30) {
  const report = await computeTeamPerformance(projectId, windowDays);
  const body = `# Team performance — ${report.projectName}

Generated: ${report.generatedAt}  
Window: last ${report.windowDays} days  
Provenance: **observed** FACCI DB records

## Task outcomes
| Metric | Count |
|---|---|
| Total tasks | ${report.tasks.total} |
| Completed (all) | ${report.tasks.completed} |
| Completed operational | ${report.tasks.operationalCompleted} |
| Completed validation | ${report.tasks.validationCompleted} |
| Failed | ${report.tasks.failed} |
| Blocked | ${report.tasks.blocked} |
| Cancelled | ${report.tasks.cancelled} |

## Specialists
| Agent | Template | Steps ok | Steps failed | Tasks touched | Avg plan latency |
|---|---|---|---|---|---|
${report.specialists
  .map(
    (s) =>
      `| ${s.agentName} | \`${s.templateKey}\` | ${s.stepsCompleted} | ${s.stepsFailed} | ${s.tasksTouched} | ${s.avgPlanLatencyMs ?? "—"} ms |`,
  )
  .join("\n")}

## Notes
${report.notes.map((n) => `- ${n}`).join("\n")}
`;

  const written = writeProjectArtifact({
    projectSlug: report.projectSlug,
    filename: `${Date.now()}-${report.projectSlug}-team-performance.md`,
    content: body,
  });
  const contentHash = createHash("sha256").update(body).digest("hex");
  const artifact = await prisma.artifact.create({
    data: {
      projectId,
      kind: "team-performance",
      title: `Team performance (${report.windowDays}d)`,
      storageRef: written.storageRef,
      contentHash,
      metadataJson: JSON.stringify({
        generatedAt: report.generatedAt,
        windowDays: report.windowDays,
        provenance: "observed",
      }),
    },
  });

  await upsertProjectMemory({
    projectId,
    category: "team_performance",
    content: body.slice(0, 4000),
    sourceRef: artifact.id,
    verify: true,
  });

  return { report, artifact, storageRef: written.storageRef };
}
