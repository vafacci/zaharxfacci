import { prisma } from "@/lib/db";

export type ProjectMetrics = {
  projectId: string;
  slug: string;
  name: string;
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    operational: number;
    validation: number;
    completed: number;
    failed: number;
    blocked: number;
    completionRate: number | null;
  };
  artifacts: number;
  schedules: { total: number; enabled: number };
  memories: number;
  avgPlanLatencyMs: number | null;
  recentFailures: { taskId: string; title: string; error: string | null }[];
};

export type OrgMetrics = {
  generatedAt: string;
  projects: ProjectMetrics[];
  totals: {
    tasks: number;
    completed: number;
    failed: number;
    artifacts: number;
    enabledSchedules: number;
  };
};

export async function computeProjectMetrics(projectId?: string): Promise<OrgMetrics> {
  const projects = await prisma.project.findMany({
    where: projectId ? { id: projectId } : undefined,
    select: {
      id: true,
      slug: true,
      name: true,
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          origin: true,
          runs: {
            select: { planLatencyMs: true, errorMessage: true, status: true },
            orderBy: { attempt: "desc" },
            take: 1,
          },
        },
      },
      _count: {
        select: { artifacts: true, memories: true, schedules: true },
      },
      schedules: { select: { enabled: true } },
    },
    orderBy: { name: "asc" },
  });

  const projectMetrics: ProjectMetrics[] = projects.map((p) => {
    const byStatus: Record<string, number> = {};
    let operational = 0;
    let validation = 0;
    let completed = 0;
    let failed = 0;
    let blocked = 0;
    const latencies: number[] = [];
    const recentFailures: ProjectMetrics["recentFailures"] = [];

    for (const t of p.tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (t.origin === "validation") validation += 1;
      else operational += 1;
      if (t.status === "completed") completed += 1;
      if (t.status === "failed") failed += 1;
      if (t.status === "blocked") blocked += 1;
      const latency = t.runs[0]?.planLatencyMs;
      if (typeof latency === "number" && latency >= 0) latencies.push(latency);
      if (t.status === "failed" || t.status === "blocked") {
        recentFailures.push({
          taskId: t.id,
          title: t.title,
          error: t.runs[0]?.errorMessage ?? null,
        });
      }
    }

    const decided = completed + failed + blocked;
    const avgPlanLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;

    return {
      projectId: p.id,
      slug: p.slug,
      name: p.name,
      tasks: {
        total: p.tasks.length,
        byStatus,
        operational,
        validation,
        completed,
        failed,
        blocked,
        completionRate: decided > 0 ? Math.round((completed / decided) * 1000) / 10 : null,
      },
      artifacts: p._count.artifacts,
      schedules: {
        total: p._count.schedules,
        enabled: p.schedules.filter((s) => s.enabled).length,
      },
      memories: p._count.memories,
      avgPlanLatencyMs,
      recentFailures: recentFailures.slice(0, 5),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    projects: projectMetrics,
    totals: {
      tasks: projectMetrics.reduce((n, p) => n + p.tasks.total, 0),
      completed: projectMetrics.reduce((n, p) => n + p.tasks.completed, 0),
      failed: projectMetrics.reduce((n, p) => n + p.tasks.failed, 0),
      artifacts: projectMetrics.reduce((n, p) => n + p.artifacts, 0),
      enabledSchedules: projectMetrics.reduce((n, p) => n + p.schedules.enabled, 0),
    },
  };
}
