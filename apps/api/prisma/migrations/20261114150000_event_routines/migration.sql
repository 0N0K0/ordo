-- Occurrences of routines (a day each) an event is about: done during the event, which does not keep their assignees
-- from them.
CREATE TABLE "CalendarEventRoutine" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "CalendarEventRoutine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CalendarEventRoutine_routineId_idx" ON "CalendarEventRoutine"("routineId");
CREATE INDEX "CalendarEventRoutine_workspaceId_idx" ON "CalendarEventRoutine"("workspaceId");
CREATE UNIQUE INDEX "CalendarEventRoutine_eventId_routineId_date_key" ON "CalendarEventRoutine"("eventId", "routineId", "date");
ALTER TABLE "CalendarEventRoutine" ADD CONSTRAINT "CalendarEventRoutine_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventRoutine" ADD CONSTRAINT "CalendarEventRoutine_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventRoutine" ADD CONSTRAINT "CalendarEventRoutine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
