-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "scheduleColor" TEXT,
ADD COLUMN     "scheduleDayBar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "scheduleDayDisplay" TEXT NOT NULL DEFAULT 'SLOT_BACKGROUND',
ADD COLUMN     "scheduleMonthDisplay" TEXT NOT NULL DEFAULT 'BACKGROUND',
ADD COLUMN     "scheduleName" TEXT;
