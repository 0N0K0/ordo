-- A workspace subscribes to a kind of schedules of another workspace (or to its schedules without kind), not to
-- one schedule: existing subscriptions become subscriptions to the kind of their schedule.

ALTER TABLE "WorkScheduleSubscription" ADD COLUMN "sourceWorkspaceId" TEXT, ADD COLUMN "typeId" TEXT;
UPDATE "WorkScheduleSubscription" s SET "sourceWorkspaceId" = w."workspaceId", "typeId" = w."typeId" FROM "WorkSchedule" w WHERE w."id" = s."scheduleId";
-- Several schedules of a same kind: one subscription.
DELETE FROM "WorkScheduleSubscription" a USING "WorkScheduleSubscription" b
WHERE a."id" > b."id" AND a."workspaceId" = b."workspaceId" AND a."sourceWorkspaceId" = b."sourceWorkspaceId" AND a."typeId" IS NOT DISTINCT FROM b."typeId";
ALTER TABLE "WorkScheduleSubscription" ALTER COLUMN "sourceWorkspaceId" SET NOT NULL;

ALTER TABLE "WorkScheduleSubscription" DROP CONSTRAINT "WorkScheduleSubscription_scheduleId_fkey";
DROP INDEX "WorkScheduleSubscription_scheduleId_idx";
DROP INDEX "WorkScheduleSubscription_workspaceId_scheduleId_key";
ALTER TABLE "WorkScheduleSubscription" DROP COLUMN "scheduleId";

CREATE INDEX "WorkScheduleSubscription_sourceWorkspaceId_idx" ON "WorkScheduleSubscription"("sourceWorkspaceId");
CREATE INDEX "WorkScheduleSubscription_typeId_idx" ON "WorkScheduleSubscription"("typeId");
CREATE UNIQUE INDEX "WorkScheduleSubscription_workspaceId_sourceWorkspaceId_type_key" ON "WorkScheduleSubscription"("workspaceId", "sourceWorkspaceId", "typeId");

ALTER TABLE "WorkScheduleSubscription" ADD CONSTRAINT "WorkScheduleSubscription_sourceWorkspaceId_fkey" FOREIGN KEY ("sourceWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkScheduleSubscription" ADD CONSTRAINT "WorkScheduleSubscription_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ScheduleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
