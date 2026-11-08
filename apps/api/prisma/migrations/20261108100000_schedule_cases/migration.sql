-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "cases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "exceptions" JSONB NOT NULL DEFAULT '[]';

