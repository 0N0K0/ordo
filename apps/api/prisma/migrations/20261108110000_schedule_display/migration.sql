-- AlterTable
ALTER TABLE "ScheduleType" ADD COLUMN     "dayBar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dayDisplay" TEXT NOT NULL DEFAULT 'SLOT_BACKGROUND',
ADD COLUMN     "monthDisplay" TEXT NOT NULL DEFAULT 'BACKGROUND';

-- AlterTable
ALTER TABLE "WorkScheduleSubscription" ADD COLUMN     "color" TEXT,
ADD COLUMN     "dayBar" BOOLEAN,
ADD COLUMN     "dayDisplay" TEXT,
ADD COLUMN     "monthDisplay" TEXT;
