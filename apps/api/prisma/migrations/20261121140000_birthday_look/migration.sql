-- Birthdays display of a workspace (decision FX): shown or not, color and display, as a kind of éphémérides.
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "birthdayShown" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "birthdayColor" TEXT,
ADD COLUMN     "birthdayDayDisplay" TEXT NOT NULL DEFAULT 'SLOT_BACKGROUND',
ADD COLUMN     "birthdayDayBar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "birthdayMonthDisplay" TEXT NOT NULL DEFAULT 'BACKGROUND';
