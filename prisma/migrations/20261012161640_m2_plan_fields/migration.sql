-- AlterTable
ALTER TABLE "TaskRun" ADD COLUMN "modelId" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "planJson" TEXT;
ALTER TABLE "TaskRun" ADD COLUMN "planLatencyMs" INTEGER;
