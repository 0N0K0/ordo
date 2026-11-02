-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "occurrenceDate" DATE,
ADD COLUMN     "recurrence" JSONB,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "CalendarCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "startTime" TEXT,
    "endDate" DATE NOT NULL,
    "endTime" TEXT,
    "timeZone" TEXT NOT NULL,
    "recurrence" JSONB,
    "reminders" INTEGER[],
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventException" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "links" JSONB,
    "allDay" BOOLEAN,
    "startDate" DATE,
    "startTime" TEXT,
    "endDate" DATE,
    "endTime" TEXT,

    CONSTRAINT "CalendarEventException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CalendarCategoryToCalendarEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CalendarCategoryToCalendarEvent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CalendarEventToContributor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CalendarEventToContributor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "CalendarCategory_parentId_idx" ON "CalendarCategory"("parentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventException_eventId_date_key" ON "CalendarEventException"("eventId", "date");

-- CreateIndex
CREATE INDEX "_CalendarCategoryToCalendarEvent_B_index" ON "_CalendarCategoryToCalendarEvent"("B");

-- CreateIndex
CREATE INDEX "_CalendarEventToContributor_B_index" ON "_CalendarEventToContributor"("B");

-- CreateIndex
CREATE INDEX "Task_seriesId_idx" ON "Task"("seriesId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarCategory" ADD CONSTRAINT "CalendarCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CalendarCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventException" ADD CONSTRAINT "CalendarEventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarCategoryToCalendarEvent" ADD CONSTRAINT "_CalendarCategoryToCalendarEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarCategoryToCalendarEvent" ADD CONSTRAINT "_CalendarCategoryToCalendarEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToContributor" ADD CONSTRAINT "_CalendarEventToContributor_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToContributor" ADD CONSTRAINT "_CalendarEventToContributor_B_fkey" FOREIGN KEY ("B") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

