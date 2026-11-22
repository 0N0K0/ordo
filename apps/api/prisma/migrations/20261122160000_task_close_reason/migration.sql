-- How a task is closed: done (COMPLETED) or cancelled (NOT_PLANNED, as the state reason of a GitHub issue); none
-- while open. A status of category « Annulé » no longer closes nor reopens tasks by itself: rules of the automations
-- of the tasks do it, created below in each workspace that has such a status, editable like any other rule.
--
-- Changes existing data: the closed tasks get their close reason (cancelled when their status is of category
-- « Annulé », done otherwise); new rows in "TaskAutomation". PostgreSQL 9.6 compatible.

-- CreateEnum
CREATE TYPE "TaskCloseReason" AS ENUM ('COMPLETED', 'NOT_PLANNED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "closeReason" "TaskCloseReason";

-- Data: the closed tasks, cancelled when closed by a status « Annulé », done otherwise (the status history trigger
-- watches only the status and the open / closed state: nothing recorded).
UPDATE "Task" AS t
SET "closeReason" = CASE
  WHEN EXISTS (SELECT 1 FROM "TaskStatus" AS s WHERE s."id" = t."statusId" AND s."category" = 'CANCELLED') THEN 'NOT_PLANNED'::"TaskCloseReason"
  ELSE 'COMPLETED'::"TaskCloseReason"
END
WHERE t."closedAt" IS NOT NULL;

-- Data: in each workspace with a status « Annulé », the rules giving the behaviour the status had, after the existing
-- rules, on (a rule whose name is already taken in the workspace is not created):
--   1. « Statut annulé : fermer comme annulée »: the status changes to one of category « Annulé » → closed as cancelled;
--   2. « Fermée comme annulée : statut annulé »: closed as cancelled with a status of another category → the first
--      status « Annulé » not archived (only when there is one);
--   3. « Statut non annulé : rouvrir »: the status of a cancelled task changes to one of another category, or to none
--      → reopened;
--   4. « Rouverte : statut à faire »: reopened with a status « Annulé » → the first status « À faire » not archived
--      (none when there is none).
WITH "workspaces" AS (
  SELECT DISTINCT s."workspaceId" FROM "TaskStatus" AS s WHERE s."category" = 'CANCELLED'
),
"base" AS (
  SELECT
    w."workspaceId",
    COALESCE((SELECT MAX(a."position") FROM "TaskAutomation" AS a WHERE a."workspaceId" = w."workspaceId"), -1) AS "last",
    (SELECT s."id" FROM "TaskStatus" AS s WHERE s."workspaceId" = w."workspaceId" AND s."category" = 'CANCELLED' AND s."archivedAt" IS NULL ORDER BY s."position", s."id" LIMIT 1) AS "cancelledId",
    (SELECT s."id" FROM "TaskStatus" AS s WHERE s."workspaceId" = w."workspaceId" AND s."category" = 'TODO' AND s."archivedAt" IS NULL ORDER BY s."position", s."id" LIMIT 1) AS "todoId"
  FROM "workspaces" AS w
),
"rules" AS (
  SELECT b."workspaceId", b."last" + 1 AS "position", 'Statut annulé : fermer comme annulée' AS "label", '#fa5252' AS "color",
    '{"event":"FIELD_CHANGED","field":"STATUS","change":"CHANGED","value":null}' AS "trigger",
    '{"type":"group","id":"root","combinator":"and","children":[{"type":"condition","id":"cancelled-status","field":"statusCategory","operator":"in","value":["CANCELLED"]}]}' AS "condition",
    '[{"kind":"CLOSE_NOT_PLANNED","field":null,"value":null}]' AS "actions"
  FROM "base" AS b
  UNION ALL
  SELECT b."workspaceId", b."last" + 2, 'Fermée comme annulée : statut annulé', '#fa5252',
    '{"event":"CLOSED_NOT_PLANNED","field":null,"change":null,"value":null}',
    '{"type":"group","id":"root","combinator":"and","children":[{"type":"condition","id":"other-status","field":"statusCategory","operator":"notIn","value":["CANCELLED"]}]}',
    '[{"kind":"SET","field":"STATUS","value":"' || b."cancelledId" || '"}]'
  FROM "base" AS b
  WHERE b."cancelledId" IS NOT NULL
  UNION ALL
  SELECT b."workspaceId", b."last" + 3, 'Statut non annulé : rouvrir', '#228be6',
    '{"event":"FIELD_CHANGED","field":"STATUS","change":"CHANGED","value":null}',
    '{"type":"group","id":"root","combinator":"and","children":[{"type":"condition","id":"cancelled-task","field":"closeReason","operator":"in","value":["NOT_PLANNED"]},{"type":"condition","id":"other-status","field":"statusCategory","operator":"notIn","value":["CANCELLED"]}]}',
    '[{"kind":"REOPEN","field":null,"value":null}]'
  FROM "base" AS b
  UNION ALL
  SELECT b."workspaceId", b."last" + 4, 'Rouverte : statut à faire', '#228be6',
    '{"event":"REOPENED","field":null,"change":null,"value":null}',
    '{"type":"group","id":"root","combinator":"and","children":[{"type":"condition","id":"cancelled-status","field":"statusCategory","operator":"in","value":["CANCELLED"]}]}',
    CASE WHEN b."todoId" IS NULL THEN '[{"kind":"CLEAR","field":"STATUS","value":null}]' ELSE '[{"kind":"SET","field":"STATUS","value":"' || b."todoId" || '"}]' END
  FROM "base" AS b
)
INSERT INTO "TaskAutomation" ("id", "label", "color", "position", "enabled", "trigger", "condition", "actions", "updatedAt", "workspaceId")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || r."workspaceId" || r."label"), r."label", r."color", r."position", true,
  r."trigger"::jsonb, r."condition"::jsonb, r."actions"::jsonb, CURRENT_TIMESTAMP, r."workspaceId"
FROM "rules" AS r
WHERE NOT EXISTS (SELECT 1 FROM "TaskAutomation" AS a WHERE a."workspaceId" = r."workspaceId" AND a."label" = r."label");
