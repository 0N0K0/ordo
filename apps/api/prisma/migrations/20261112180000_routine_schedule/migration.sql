-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "scheduleAnchor" TEXT,
ADD COLUMN     "scheduleId" TEXT;

-- CreateIndex
CREATE INDEX "Routine_scheduleId_idx" ON "Routine"("scheduleId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

