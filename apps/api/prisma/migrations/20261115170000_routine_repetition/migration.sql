-- Times of the day of a routine following its rule or its calendar schedules (several; none: its former window).
ALTER TABLE "Routine" ADD COLUMN "moments" JSONB NOT NULL DEFAULT '[]';
-- Calendar schedules it follows (one or another), and those it is done out of.
ALTER TABLE "Routine" ADD COLUMN "scheduleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Routine" ADD COLUMN "excludedScheduleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- The schedule it followed becomes the first of its schedules.
UPDATE "Routine" SET "scheduleIds" = ARRAY["scheduleId"] WHERE "scheduleId" IS NOT NULL;
