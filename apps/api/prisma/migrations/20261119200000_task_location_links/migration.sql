-- Tasks and routines get the links of the calendar events (decision D5): [{ url, label }], 20 at most, http or https,
-- label optional; none for the existing ones.
-- A task can have a location (decision D6): free text and its point when chosen from the map or a search, as an event
-- or a routine; no travel time (a task has no hours). None for the existing ones: no data is changed.
ALTER TABLE "Task" ADD COLUMN "location" TEXT,
ADD COLUMN "locationLat" DOUBLE PRECISION,
ADD COLUMN "locationLon" DOUBLE PRECISION,
ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Routine" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]';
