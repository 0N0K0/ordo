-- On or out of calendar schedules, combined in groups (and / or), for a routine following its rule; none: any time.
ALTER TABLE "Routine" ADD COLUMN "slotCondition" JSONB;
