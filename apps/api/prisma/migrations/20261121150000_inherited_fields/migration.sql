-- Live inheritance of the sub-tasks and sub-routines (decision D11, lot 13a). Each task and routine gets the list of
-- the fields it takes from its parent ("inheritedFields"): a field listed goes by its parent's value (live, up the
-- chain); a field not listed is its own value, or emptied on purpose when it has none. A top-level item inherits
-- nothing.
--
-- Existing data changes here: for every sub-task and sub-routine, each inheritable field whose stored value is still
-- identical to its parent's (a copy made at its creation, or both empty) becomes inherited; a different value (an
-- empty one included, when the parent has one) stays its own. The values themselves are not touched. Lists (people,
-- categories) are compared as sets. PostgreSQL 9.6 compatible (array_remove, IS NOT DISTINCT FROM on jsonb).

ALTER TABLE "Task" ADD COLUMN "inheritedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Routine" ADD COLUMN "inheritedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Task" c
SET "inheritedFields" = array_remove(ARRAY[
  CASE WHEN c."projectId" IS NOT DISTINCT FROM p."projectId" THEN 'PROJECT' END,
  CASE WHEN ARRAY(SELECT "A" FROM "_ContributorToTask" WHERE "B" = c."id" ORDER BY 1)
          = ARRAY(SELECT "A" FROM "_ContributorToTask" WHERE "B" = p."id" ORDER BY 1) THEN 'ASSIGNEES' END,
  CASE WHEN ARRAY(SELECT "A" FROM "_TaskBeneficiaries" WHERE "B" = c."id" ORDER BY 1)
          = ARRAY(SELECT "A" FROM "_TaskBeneficiaries" WHERE "B" = p."id" ORDER BY 1)
        AND ARRAY(SELECT "B" FROM "_TaskBeneficiaryRelations" WHERE "A" = c."id" ORDER BY 1)
          = ARRAY(SELECT "B" FROM "_TaskBeneficiaryRelations" WHERE "A" = p."id" ORDER BY 1) THEN 'BENEFICIARIES' END,
  CASE WHEN c."slotCondition" IS NOT DISTINCT FROM p."slotCondition" THEN 'SLOT_CONDITION' END,
  CASE WHEN c."minDate" IS NOT DISTINCT FROM p."minDate" THEN 'MIN_DATE' END,
  CASE WHEN c."deadline" IS NOT DISTINCT FROM p."deadline" THEN 'DEADLINE' END,
  CASE WHEN c."location" IS NOT DISTINCT FROM p."location"
        AND c."locationLat" IS NOT DISTINCT FROM p."locationLat"
        AND c."locationLon" IS NOT DISTINCT FROM p."locationLon" THEN 'LOCATION' END,
  CASE WHEN c."priorityId" IS NOT DISTINCT FROM p."priorityId" THEN 'PRIORITY' END,
  CASE WHEN c."milestoneId" IS NOT DISTINCT FROM p."milestoneId" THEN 'MILESTONE' END
]::TEXT[], NULL)
FROM "Task" p
WHERE c."parentId" = p."id";

UPDATE "Routine" c
SET "inheritedFields" = array_remove(ARRAY[
  CASE WHEN c."projectId" IS NOT DISTINCT FROM p."projectId" THEN 'PROJECT' END,
  CASE WHEN ARRAY(SELECT "A" FROM "_RoutineAssignees" WHERE "B" = c."id" ORDER BY 1)
          = ARRAY(SELECT "A" FROM "_RoutineAssignees" WHERE "B" = p."id" ORDER BY 1) THEN 'ASSIGNEES' END,
  CASE WHEN ARRAY(SELECT "A" FROM "_RoutineBeneficiaries" WHERE "B" = c."id" ORDER BY 1)
          = ARRAY(SELECT "A" FROM "_RoutineBeneficiaries" WHERE "B" = p."id" ORDER BY 1)
        AND ARRAY(SELECT "B" FROM "_RoutineBeneficiaryRelations" WHERE "A" = c."id" ORDER BY 1)
          = ARRAY(SELECT "B" FROM "_RoutineBeneficiaryRelations" WHERE "A" = p."id" ORDER BY 1) THEN 'BENEFICIARIES' END,
  CASE WHEN c."slotCondition" IS NOT DISTINCT FROM p."slotCondition"
        AND c."scheduleIds" = p."scheduleIds"
        AND c."excludedScheduleIds" = p."excludedScheduleIds" THEN 'SLOT_CONDITION' END,
  CASE WHEN c."opensOn" IS NOT DISTINCT FROM p."opensOn" THEN 'OPENS_ON' END,
  CASE WHEN c."location" IS NOT DISTINCT FROM p."location"
        AND c."locationLat" IS NOT DISTINCT FROM p."locationLat"
        AND c."locationLon" IS NOT DISTINCT FROM p."locationLon" THEN 'LOCATION' END,
  CASE WHEN ARRAY(SELECT "B" FROM "_RoutineCategories" WHERE "A" = c."id" ORDER BY 1)
          = ARRAY(SELECT "B" FROM "_RoutineCategories" WHERE "A" = p."id" ORDER BY 1) THEN 'CATEGORIES' END,
  CASE WHEN c."startDate" = p."startDate" THEN 'START_DATE' END,
  CASE WHEN c."recurrence" = p."recurrence"
        AND c."scheduleId" IS NOT DISTINCT FROM p."scheduleId"
        AND c."scheduleAnchor" IS NOT DISTINCT FROM p."scheduleAnchor" THEN 'RECURRENCE' END,
  CASE WHEN c."cases" = p."cases" THEN 'CASES' END,
  CASE WHEN c."moments" = p."moments"
        AND c."fromTime" IS NOT DISTINCT FROM p."fromTime"
        AND c."dueTime" IS NOT DISTINCT FROM p."dueTime" THEN 'MOMENTS' END,
  CASE WHEN c."moves" = p."moves" THEN 'MOVES' END
]::TEXT[], NULL)
FROM "Routine" p
WHERE c."parentId" = p."id";
