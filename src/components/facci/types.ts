export type Agent = {
  id: string;
  name: string;
  role: string;
  templateKey: string;
  projectId: string | null;
  parentAgentId: string | null;
  status: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  mission: string | null;
  agents: Agent[];
  _count?: { tasks: number; artifacts: number };
};

export type Task = {
  id: string;
  title: string;
  objective: string;
  status: string;
  origin?: string;
  projectId: string;
  project: { id: string; name: string; slug: string };
  assignedAgent: { name: string } | null;
  artifacts: { id: string; title: string; storageRef: string; kind?: string }[];
  approvals: { id: string; state: string; actionType: string }[];
  runs: {
    id: string;
    status: string;
    modelProvider: string | null;
    modelId?: string | null;
    planLatencyMs?: number | null;
    errorMessage: string | null;
    steps: {
      id: string;
      sequence: number;
      actionType: string;
      inputSummary: string | null;
      outputSummary: string | null;
      status: string;
      agent: { name: string } | null;
    }[];
  }[];
  latestPlan?: {
    plannerId?: string;
    labeledAs?: string;
    isLiveModel?: boolean;
    modelId?: string;
    latencyMs?: number;
    reasoningSummary?: string;
    specialistTemplateKey?: string;
    steps?: { sequence: number; agentRole: string; actionType: string; summary: string }[];
  } | null;
  latestRunMeta?: {
    modelProvider: string | null;
    modelId: string | null;
    planLatencyMs: number | null;
    status: string;
    errorMessage: string | null;
  } | null;
};

export type Overview = {
  demoLabel: string;
  plannerMode?: string;
  gpuGuard?: { details: string; recommendCpuOffload: boolean; comfyUiLikelyRunning: boolean };
  planner: {
    id: string;
    label: string;
    isLiveModel: boolean;
    health: { healthy: boolean; details?: string; modelId?: string };
  };
  organization: {
    name: string;
    ownerName: string;
    projects: Project[];
    agents: Agent[];
  } | null;
  tasks: Task[];
  approvals: {
    id: string;
    actionType: string;
    actionSummary: string;
    riskLevel: string;
    state: string;
    task: { id: string; title: string; project: { name: string } };
  }[];
  audit: {
    id: string;
    actor: string;
    verb: string;
    target: string;
    createdAt: string;
    projectId: string | null;
  }[];
  artifacts: {
    id: string;
    title: string;
    kind: string;
    storageRef: string;
    project: { name: string; slug: string };
    task: { title: string } | null;
  }[];
  tools: {
    id: string;
    name: string;
    adapterType: string;
    state: string;
    liveNote: string | null;
  }[];
  counts: {
    projects: number;
    queued: number;
    running: number;
    waitingApproval: number;
    completed: number;
    blocked: number;
  };
  schedules?: {
    id: string;
    title: string;
    rule: string;
    enabled: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastTaskId: string | null;
    project: { id: string; name: string; slug: string };
  }[];
  metrics?: {
    generatedAt: string;
    projects: {
      projectId: string;
      slug: string;
      name: string;
      tasks: {
        total: number;
        completed: number;
        failed: number;
        blocked: number;
        completionRate: number | null;
        operational: number;
        validation: number;
      };
      artifacts: number;
      schedules: { total: number; enabled: number };
      avgPlanLatencyMs: number | null;
    }[];
    totals: {
      tasks: number;
      completed: number;
      failed: number;
      artifacts: number;
      enabledSchedules: number;
    };
  };
  backups?: { relativePath: string; bytes: number; mtime: string }[];
  monthKey?: string;
  budgets?: {
    id: string;
    projectId: string | null;
    monthKey: string;
    maxPlanCalls: number;
    usedPlanCalls: number;
    maxImageGens: number;
    usedImageGens: number;
    maxTaskCreates: number;
    usedTaskCreates: number;
    remoteModelConsent: boolean;
    remoteModelMaxCalls: number;
    usedRemoteCalls: number;
  }[];
  portfolio?: {
    id: string;
    slug: string;
    name: string;
    priority: number;
    status: string;
    queuedTasks: number;
  }[];
  remoteModel?: {
    enabled: boolean;
    ready: boolean;
    blockedReason: string | null;
    billingNote: string;
    provider: string;
    apiKeyConfigured: boolean;
  };
  /** AUTIQ weekly content flywheel status (next theme from analytics memory). */
  flywheel?: {
    projectSlug: string;
    scheduleEnabled: boolean;
    nextRunAt: string | null;
    nextThemeMemory: {
      content: string;
      updatedAt: string;
      sourceRef: string | null;
    } | null;
  } | null;
};
