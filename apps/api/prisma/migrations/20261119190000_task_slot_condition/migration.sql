-- Tasks take the slot condition of the routines (decision D9): on or out of calendar schedules or kinds of schedules
-- (of this workspace or of another one of the user), or on the free time, in groups (and / or). Without condition a
-- task or a routine can be done at any time (D10): the default of the workspace (the working hours in a professional
-- workspace) no longer applies.
--
-- The slot rule of a task (by kinds of schedules) becomes the same condition on those kinds (decision DX), nothing
-- lost: the schedules of a kind created later still count.
--   - « pendant » kinds (`inside`, or the former `{ mode: 'INSIDE', kinds }`): « sur l'un des types » (`kinds in`);
--   - « hors de » kinds (`outside`, or the former `{ mode: 'OUTSIDE', kinds }`): « hors des types » (`kinds notIn`);
--   - both in one « et » group, each list in its order; the kind `default` stays the one of the schedules without
--     kind, a kind of another workspace (`ws:<workspace>:<kind>`) stays that kind of that workspace;
--   - only references to nothing are left out (a kind deleted, a workspace deleted, `ws:` naming the workspace of the
--     task itself): they constrained nothing already; nothing left (or `{ mode: 'ANY' }`, or empty lists): no condition.
-- A task without rule (the default of the workspace) keeps no condition. The rule column of the tasks is dropped, and
-- the one of the routines (no longer written nor read since their conditions) too.
ALTER TABLE "Task" ADD COLUMN "slotCondition" JSONB;

WITH rules AS (
  SELECT t."id", t."workspaceId",
    CASE WHEN t."slotRule" ? 'mode' THEN CASE WHEN t."slotRule"->>'mode' = 'INSIDE' THEN t."slotRule"->'kinds' END ELSE t."slotRule"->'inside' END AS "inside",
    CASE WHEN t."slotRule" ? 'mode' THEN CASE WHEN t."slotRule"->>'mode' = 'OUTSIDE' THEN t."slotRule"->'kinds' END ELSE t."slotRule"->'outside' END AS "outside"
  FROM "Task" t
  WHERE jsonb_typeof(t."slotRule") = 'object'
),
sides AS (
  SELECT r."id", r."workspaceId", side."operator", side."kinds"
  FROM rules r
  CROSS JOIN LATERAL (VALUES ('in', r."inside"), ('notIn', r."outside")) AS side("operator", "kinds")
  WHERE jsonb_typeof(side."kinds") = 'array'
),
refs AS (
  SELECT s."id", s."workspaceId", s."operator", kind."ref", MIN(kind."n") AS "n"
  FROM sides s
  CROSS JOIN LATERAL jsonb_array_elements_text(s."kinds") WITH ORDINALITY AS kind("ref", "n")
  GROUP BY s."id", s."workspaceId", s."operator", kind."ref"
),
known AS (
  SELECT r."id", r."operator", r."ref", r."n"
  FROM refs r
  WHERE r."ref" = 'default'
    OR EXISTS (SELECT 1 FROM "ScheduleType" st WHERE st."workspaceId" = r."workspaceId" AND st."id" = r."ref")
    OR EXISTS (SELECT 1 FROM "Workspace" w WHERE w."id" <> r."workspaceId" AND r."ref" = 'ws:' || w."id" || ':default')
    OR EXISTS (SELECT 1 FROM "ScheduleType" st WHERE st."workspaceId" <> r."workspaceId" AND r."ref" = 'ws:' || st."workspaceId" || ':' || st."id")
),
named AS (
  SELECT k."id", k."operator", jsonb_agg(k."ref" ORDER BY k."n") AS "value"
  FROM known k
  GROUP BY k."id", k."operator"
),
conditions AS (
  SELECT n."id",
    jsonb_build_object('type', 'group', 'id', 'root', 'combinator', 'and', 'children',
      jsonb_agg(jsonb_build_object('type', 'condition', 'id', CASE n."operator" WHEN 'in' THEN 'on' ELSE 'out' END, 'field', 'kinds', 'operator', n."operator", 'value', n."value") ORDER BY n."operator")) AS "condition"
  FROM named n
  GROUP BY n."id"
)
UPDATE "Task" t SET "slotCondition" = c."condition" FROM conditions c WHERE c."id" = t."id";

ALTER TABLE "Task" DROP COLUMN "slotRule";
ALTER TABLE "Routine" DROP COLUMN "slotRule";
