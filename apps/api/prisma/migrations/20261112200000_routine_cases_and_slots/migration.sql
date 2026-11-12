-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "cases" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "RoutineCheck" DROP CONSTRAINT "RoutineCheck_pkey",
ADD COLUMN     "slot" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("routineId", "date", "slot");

