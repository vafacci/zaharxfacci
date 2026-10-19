-- M5: schedule execution tracking
ALTER TABLE "Schedule" ADD COLUMN "lastRunAt" DATETIME;
ALTER TABLE "Schedule" ADD COLUMN "lastTaskId" TEXT;
CREATE INDEX "Schedule_enabled_nextRunAt_idx" ON "Schedule"("enabled", "nextRunAt");
