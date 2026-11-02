-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_closedAt_idx" ON "Task"("closedAt");


-- Tasks whose status means done or cancelled start closed.
UPDATE "Task" t SET "closedAt" = t."updatedAt"
FROM "TaskStatus" s
WHERE t."statusId" = s."id" AND s."category" IN ('DONE', 'CANCELLED') AND t."closedAt" IS NULL;
