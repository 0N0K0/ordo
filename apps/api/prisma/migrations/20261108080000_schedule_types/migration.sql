-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "typeId" TEXT;

-- CreateTable
CREATE TABLE "ScheduleType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ScheduleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleSubscription" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "WorkScheduleSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleType_workspaceId_name_key" ON "ScheduleType"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkScheduleSubscription_scheduleId_idx" ON "WorkScheduleSubscription"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleSubscription_workspaceId_scheduleId_key" ON "WorkScheduleSubscription"("workspaceId", "scheduleId");

-- AddForeignKey
ALTER TABLE "ScheduleType" ADD CONSTRAINT "ScheduleType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleSubscription" ADD CONSTRAINT "WorkScheduleSubscription_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleSubscription" ADD CONSTRAINT "WorkScheduleSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ScheduleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
