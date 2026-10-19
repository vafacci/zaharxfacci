-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "origin" TEXT NOT NULL DEFAULT 'operational',
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
INSERT INTO "new_Task" ("assignedAgentId", "completedAt", "createdAt", "id", "idempotencyKey", "maxSteps", "objective", "parentTaskId", "priority", "projectId", "status", "title", "updatedAt") SELECT "assignedAgentId", "completedAt", "createdAt", "id", "idempotencyKey", "maxSteps", "objective", "parentTaskId", "priority", "projectId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_idempotencyKey_key" ON "Task"("idempotencyKey");
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
CREATE INDEX "Task_assignedAgentId_idx" ON "Task"("assignedAgentId");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");
CREATE INDEX "Task_origin_idx" ON "Task"("origin");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
