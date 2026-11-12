-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "reminders" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

