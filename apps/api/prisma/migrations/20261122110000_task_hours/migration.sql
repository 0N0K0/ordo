-- « Horaires » of a task: days and hours it can be done, cases shaped as those of a créneau; empty: any time.
--
-- Existing data changes here: every existing sub-task inherits the hours of its parent ("inheritedFields" gets
-- HOURS), as its other empty fields do (no task has hours yet). Top-level tasks are untouched. PostgreSQL 9.6
-- compatible (array_append, ANY).

ALTER TABLE "Task" ADD COLUMN "hours" JSONB NOT NULL DEFAULT '[]';

UPDATE "Task"
SET "inheritedFields" = array_append("inheritedFields", 'HOURS')
WHERE "parentId" IS NOT NULL AND NOT ('HOURS' = ANY ("inheritedFields"));
