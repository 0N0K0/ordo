-- Decision D18: a time covers several tasks, several routines and several events (occurrences).
-- Data moved: each time entry with a "routineId" gets one row (routine, entry) in "_RoutineToTimeEntry"; each time
-- entry with a "calendarEventId" gets one row (entry, event, "calendarOccurrenceDate") in "TimeEntryEvent", in the
-- workspace of the entry. The three columns are then dropped. Nothing else changes (no entry deleted).

-- Routines of a time (the implicit many-to-many of Prisma, as "_TaskToTimeEntry").
CREATE TABLE "_RoutineToTimeEntry" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineToTimeEntry_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_RoutineToTimeEntry_B_index" ON "_RoutineToTimeEntry"("B");
ALTER TABLE "_RoutineToTimeEntry" ADD CONSTRAINT "_RoutineToTimeEntry_A_fkey" FOREIGN KEY ("A") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoutineToTimeEntry" ADD CONSTRAINT "_RoutineToTimeEntry_B_fkey" FOREIGN KEY ("B") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_RoutineToTimeEntry" ("A", "B")
SELECT "routineId", "id" FROM "TimeEntry" WHERE "routineId" IS NOT NULL;

-- Events (occurrences) of a time.
CREATE TABLE "TimeEntryEvent" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceDate" DATE,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TimeEntryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TimeEntryEvent_timeEntryId_idx" ON "TimeEntryEvent"("timeEntryId");
CREATE INDEX "TimeEntryEvent_eventId_idx" ON "TimeEntryEvent"("eventId");
CREATE INDEX "TimeEntryEvent_workspaceId_idx" ON "TimeEntryEvent"("workspaceId");
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntryEvent" ADD CONSTRAINT "TimeEntryEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TimeEntryEvent" ("id", "timeEntryId", "eventId", "occurrenceDate", "workspaceId")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || "id"), "id", "calendarEventId", "calendarOccurrenceDate", "workspaceId"
FROM "TimeEntry" WHERE "calendarEventId" IS NOT NULL;

-- The single routine and event of a time are gone.
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_routineId_fkey";
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_calendarEventId_fkey";
DROP INDEX "TimeEntry_routineId_idx";
DROP INDEX "TimeEntry_calendarEventId_idx";
ALTER TABLE "TimeEntry" DROP COLUMN "calendarEventId",
DROP COLUMN "calendarOccurrenceDate",
DROP COLUMN "routineId";
