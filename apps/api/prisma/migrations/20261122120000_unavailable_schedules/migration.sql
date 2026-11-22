-- « Indisponible »: nothing is scheduled during the slots of an unavailable kind of schedules, of an unavailable
-- schedule without kind, or, in a workspace subscribing to the kind of another one, of a subscription set
-- unavailable there (each workspace decides for itself).
--
-- Additive: three boolean columns, false by default; no existing data changes. PostgreSQL 9.6 compatible.

ALTER TABLE "ScheduleType" ADD COLUMN "unavailable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkSchedule" ADD COLUMN "unavailable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkScheduleSubscription" ADD COLUMN "unavailable" BOOLEAN NOT NULL DEFAULT false;
