-- A deleted project no longer deletes its alarms (decision DP): they stay, without project, with their task. Existing
-- rows are not changed.
ALTER TABLE "Alarm" DROP CONSTRAINT "Alarm_projectId_fkey";
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
