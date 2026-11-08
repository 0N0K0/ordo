-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "travelAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travelBefore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CalendarEventException" ADD COLUMN     "travelAfter" INTEGER,
ADD COLUMN     "travelBefore" INTEGER;
