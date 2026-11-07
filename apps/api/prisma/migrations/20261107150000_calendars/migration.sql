-- Calendars: every event belongs to one; a workspace can show, read only, the calendars of other workspaces.

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSubscription" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "CalendarSubscription_pkey" PRIMARY KEY ("id")
);

-- One calendar per workspace, named after it: the existing events go into it.
INSERT INTO "Calendar" ("id", "name", "color", "position", "workspaceId")
SELECT 'cal' || substr(md5("id"), 1, 22), "name", '#228be6', 0, "id" FROM "Workspace";

ALTER TABLE "CalendarEvent" ADD COLUMN "calendarId" TEXT;
UPDATE "CalendarEvent" SET "calendarId" = 'cal' || substr(md5("workspaceId"), 1, 22);
ALTER TABLE "CalendarEvent" ALTER COLUMN "calendarId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Calendar_workspaceId_idx" ON "Calendar"("workspaceId");

-- CreateIndex
CREATE INDEX "CalendarSubscription_calendarId_idx" ON "CalendarSubscription"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSubscription_workspaceId_calendarId_key" ON "CalendarSubscription"("workspaceId", "calendarId");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarId_idx" ON "CalendarEvent"("calendarId");

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSubscription" ADD CONSTRAINT "CalendarSubscription_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSubscription" ADD CONSTRAINT "CalendarSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
