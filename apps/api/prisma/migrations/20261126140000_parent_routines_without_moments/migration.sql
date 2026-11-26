-- A routine that has sub-routines (not archived) has no moments of its own, and its ticks follow those of its
-- sub-routines; the moments are no longer inherited.

-- 1. A sub-routine inheriting its moments takes them as its own: those of the routine it goes by (up the chain of
--    parents inheriting them too; a loop stops), so its occurrences keep their times.
WITH RECURSIVE "chain" AS (
  SELECT r."id" AS "heirId", r."parentId" AS "sourceId", 1 AS "depth"
  FROM "Routine" r
  WHERE r."parentId" IS NOT NULL AND 'MOMENTS' = ANY (r."inheritedFields")
  UNION ALL
  SELECT c."heirId", s."parentId", c."depth" + 1
  FROM "chain" c
  JOIN "Routine" s ON s."id" = c."sourceId"
  WHERE s."parentId" IS NOT NULL AND 'MOMENTS' = ANY (s."inheritedFields") AND c."depth" < 100
),
"source" AS (
  SELECT DISTINCT ON (c."heirId") c."heirId", c."sourceId"
  FROM "chain" c
  ORDER BY c."heirId", c."depth" DESC
)
UPDATE "Routine" h
SET "moments" = s."moments", "fromTime" = s."fromTime", "dueTime" = s."dueTime"
FROM "source" x
JOIN "Routine" s ON s."id" = x."sourceId"
WHERE h."id" = x."heirId";

-- 2. The moments are no longer an inherited field.
UPDATE "Routine"
SET "inheritedFields" = array_remove("inheritedFields", 'MOMENTS')
WHERE 'MOMENTS' = ANY ("inheritedFields");

-- 3. Ticks of the routines that have a sub-routine not archived: their ticks follow those of their sub-routines from
--    now on.
DELETE FROM "RoutineCheck"
WHERE "routineId" IN (SELECT "parentId" FROM "Routine" WHERE "parentId" IS NOT NULL AND "archivedAt" IS NULL);

-- 4. A routine that has a sub-routine not archived loses the moments of its rule (one moment without hours); those of
--    its cases stay.
UPDATE "Routine"
SET "moments" = '[]'::jsonb, "fromTime" = NULL, "dueTime" = NULL
WHERE "id" IN (SELECT "parentId" FROM "Routine" WHERE "parentId" IS NOT NULL AND "archivedAt" IS NULL);
