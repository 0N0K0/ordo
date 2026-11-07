-- CreateEnum
CREATE TYPE "NotificationSource" AS ENUM ('ALARMS', 'CALENDAR', 'MAILS');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "notifyElsewhere" "NotificationSource"[] DEFAULT ARRAY[]::"NotificationSource"[];
