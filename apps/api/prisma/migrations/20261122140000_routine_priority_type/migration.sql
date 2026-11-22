-- Priority and type of the routines: the same lists as those of the tasks (TaskPriority, TaskType), shared by both.
-- Deleting a priority or a type clears it on the routines too.
--
-- Additive: two new nullable columns; no existing data changes. PostgreSQL 9.6 compatible.

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN "priorityId" TEXT;
ALTER TABLE "Routine" ADD COLUMN "typeId" TEXT;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "TaskPriority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
