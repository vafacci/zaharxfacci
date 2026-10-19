-- M6: owner memory, monthly budgets, bounded recurring schedule fields

CREATE TABLE "OwnerMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRef" TEXT,
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OwnerMemory_organizationId_category_idx" ON "OwnerMemory"("organizationId", "category");

CREATE TABLE "MonthlyBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL DEFAULT '',
    "monthKey" TEXT NOT NULL,
    "maxPlanCalls" INTEGER NOT NULL DEFAULT 200,
    "maxImageGens" INTEGER NOT NULL DEFAULT 40,
    "maxTaskCreates" INTEGER NOT NULL DEFAULT 300,
    "usedPlanCalls" INTEGER NOT NULL DEFAULT 0,
    "usedImageGens" INTEGER NOT NULL DEFAULT 0,
    "usedTaskCreates" INTEGER NOT NULL DEFAULT 0,
    "remoteModelConsent" BOOLEAN NOT NULL DEFAULT false,
    "remoteModelMaxCalls" INTEGER NOT NULL DEFAULT 0,
    "usedRemoteCalls" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MonthlyBudget_organizationId_projectId_monthKey_key" ON "MonthlyBudget"("organizationId", "projectId", "monthKey");
CREATE INDEX "MonthlyBudget_monthKey_idx" ON "MonthlyBudget"("monthKey");

ALTER TABLE "Schedule" ADD COLUMN "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Schedule" ADD COLUMN "ownerApprovedAt" DATETIME;
ALTER TABLE "Schedule" ADD COLUMN "maxFiresPerDay" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "Schedule" ADD COLUMN "firesToday" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Schedule" ADD COLUMN "firesDayKey" TEXT;
