-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mission" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "repositoryPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentAgentId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Agent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Agent_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentToolPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "actionPattern" TEXT NOT NULL,
    "projectId" TEXT,
    "approvalPolicy" TEXT NOT NULL DEFAULT 'none',
    CONSTRAINT "AgentToolPermission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "successCriteria" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "ownerStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxSteps" INTEGER NOT NULL DEFAULT 12,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "modelProvider" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" DATETIME,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "agentId" TEXT,
    "actionType" TEXT NOT NULL,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "evidenceRef" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "TaskStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TaskRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskStep_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "requestedByAgentId" TEXT,
    "actionSummary" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "expiresAt" DATETIME,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Approval_requestedByAgentId_fkey" FOREIGN KEY ("requestedByAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "contentHash" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Artifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adapterType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'not_configured',
    "sanitizedConfig" TEXT,
    "capabilityJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProjectMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRef" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'project',
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMemory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "actor" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "payloadRedacted" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" DATETIME,
    "actionTemplate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Agent_organizationId_idx" ON "Agent"("organizationId");

-- CreateIndex
CREATE INDEX "Agent_projectId_idx" ON "Agent"("projectId");

-- CreateIndex
CREATE INDEX "Agent_parentAgentId_idx" ON "Agent"("parentAgentId");

-- CreateIndex
CREATE INDEX "Agent_role_idx" ON "Agent"("role");

-- CreateIndex
CREATE INDEX "AgentToolPermission_agentId_idx" ON "AgentToolPermission"("agentId");

-- CreateIndex
CREATE INDEX "AgentToolPermission_toolId_idx" ON "AgentToolPermission"("toolId");

-- CreateIndex
CREATE INDEX "ProjectGoal_projectId_idx" ON "ProjectGoal"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_idempotencyKey_key" ON "Task"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_assignedAgentId_idx" ON "Task"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "TaskRun_taskId_idx" ON "TaskRun"("taskId");

-- CreateIndex
CREATE INDEX "TaskRun_status_leaseExpiresAt_idx" ON "TaskRun"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "TaskStep_runId_idx" ON "TaskStep"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStep_runId_sequence_key" ON "TaskStep"("runId", "sequence");

-- CreateIndex
CREATE INDEX "Approval_taskId_idx" ON "Approval"("taskId");

-- CreateIndex
CREATE INDEX "Approval_state_idx" ON "Approval"("state");

-- CreateIndex
CREATE INDEX "Artifact_projectId_idx" ON "Artifact"("projectId");

-- CreateIndex
CREATE INDEX "Artifact_taskId_idx" ON "Artifact"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolRegistration_adapterType_key" ON "ToolRegistration"("adapterType");

-- CreateIndex
CREATE INDEX "ProjectMemory_projectId_idx" ON "ProjectMemory"("projectId");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Schedule_projectId_idx" ON "Schedule"("projectId");
