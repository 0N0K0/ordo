-- Sub-routines inherit the priority of their parent, as sub-tasks do. Routines got a priority with
-- 20261122140000_routine_priority_type, empty everywhere, but the existing sub-routines did not list it among their
-- inherited fields: their empty priority read as « cleared on purpose » instead of « inherited ».
--
-- Existing data changes here: every sub-routine without a priority of its own gets PRIORITY in "inheritedFields"
-- (only the list; no value changes). PostgreSQL 9.6 compatible.

UPDATE "Routine"
SET "inheritedFields" = array_append("inheritedFields", 'PRIORITY')
WHERE "parentId" IS NOT NULL
  AND "priorityId" IS NULL
  AND NOT ('PRIORITY' = ANY ("inheritedFields"));
