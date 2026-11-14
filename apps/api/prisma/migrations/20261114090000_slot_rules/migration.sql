-- AlterTable: the day an occurrence of a routine opens, and the slots routines and tasks are done on or out of.
ALTER TABLE "Routine" ADD COLUMN "opensOn" TEXT;
ALTER TABLE "Routine" ADD COLUMN "slotRule" JSONB;
ALTER TABLE "Task" ADD COLUMN "slotRule" JSONB;
