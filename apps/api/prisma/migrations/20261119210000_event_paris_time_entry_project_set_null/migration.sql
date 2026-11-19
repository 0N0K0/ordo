-- Every event is in Paris time (decision D7): the time zone of each event goes. Its hours stay as written, read as
-- Paris times (no conversion). Dropping the column loses its stored values (the browser's time zone at creation).
ALTER TABLE "CalendarEvent" DROP COLUMN "timeZone";

-- A deleted project no longer deletes its time (decision D17): the time stays, without project, with its tasks, routine
-- and event (the API first deletes the time left with nothing attached). Existing rows are not changed.
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_projectId_fkey";
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
