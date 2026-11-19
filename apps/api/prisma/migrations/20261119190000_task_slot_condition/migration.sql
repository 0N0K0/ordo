-- Tasks take the slot condition of the routines (decision D9): on or out of calendar schedules, or on the free time,
-- in groups (and / or). Without condition a task or a routine can be done at any time (D10): the default of the
-- workspace (the working hours in a professional workspace) no longer applies.
--
-- The slot rule of a task (by kinds of schedules) becomes a condition on the schedules of those kinds of its workspace,
-- archived ones included:
--   - « pendant » kinds (`inside`, or the former `{ mode: 'INSIDE', kinds }`): « sur l'une des plages » of those
--     schedules (`schedules in [ids]`), the kind `default` naming the schedules without kind;
--   - « hors de » kinds (`outside`, or the former `{ mode: 'OUTSIDE', kinds }`): « hors des plages » of those schedules
--     (`schedules notIn [ids]`);
--   - both in one « et » group; kinds of other workspaces (`ws:…`) and kinds without any schedule are left out (the
--     latter constrained nothing already); nothing left (or `{ mode: 'ANY' }`): no condition.
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
named AS (
  SELECT s."id", s."operator", jsonb_agg(DISTINCT w."id" ORDER BY w."id") AS "value"
  FROM sides s
  CROSS JOIN LATERAL jsonb_array_elements_text(s."kinds") AS kind("ref")
  JOIN "WorkSchedule" w ON w."workspaceId" = s."workspaceId" AND ((kind."ref" = 'default' AND w."typeId" IS NULL) OR w."typeId" = kind."ref")
  GROUP BY s."id", s."operator"
),
conditions AS (
  SELECT n."id",
    jsonb_build_object('type', 'group', 'id', 'root', 'combinator', 'and', 'children',
      jsonb_agg(jsonb_build_object('type', 'condition', 'id', CASE n."operator" WHEN 'in' THEN 'on' ELSE 'out' END, 'field', 'schedules', 'operator', n."operator", 'value', n."value") ORDER BY n."operator")) AS "condition"
  FROM named n
  GROUP BY n."id"
)
UPDATE "Task" t SET "slotCondition" = c."condition" FROM conditions c WHERE c."id" = t."id";

ALTER TABLE "Task" DROP COLUMN "slotRule";
ALTER TABLE "Routine" DROP COLUMN "slotRule";
