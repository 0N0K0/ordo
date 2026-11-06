-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "calendarEventId" TEXT,
ADD COLUMN     "calendarOccurrenceDate" DATE;

-- CreateIndex
CREATE INDEX "TimeEntry_calendarEventId_idx" ON "TimeEntry"("calendarEventId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

