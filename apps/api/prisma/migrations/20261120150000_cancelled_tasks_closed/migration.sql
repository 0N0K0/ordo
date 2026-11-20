-- Decision D23: a task whose status is of the category « Annulé » is closed (passing to such a status closes it,
-- leaving it reopens it). Existing data changes here: the open tasks (archived ones too) that already have a
-- cancelled status are closed, dated by their last change ("updatedAt"). The status history trigger records it.
-- Statuses keep their category. PostgreSQL 9.6 compatible.
UPDATE "Task" AS t
SET "closedAt" = t."updatedAt"
FROM "TaskStatus" AS s
WHERE t."statusId" = s."id"
  AND s."category" = 'CANCELLED'
  AND t."closedAt" IS NULL;
