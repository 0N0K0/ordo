-- Lot 16a, éphémérides: an éphéméride is a schedule ("créneau") of the nature « éphéméride », set on its kind (a whole
-- kind is one or the other) or, without kind, on the schedule itself. A kind of éphémérides can be a context of the
-- treasury (« Sert de contexte au budget »), possibly shared by every workspace (« Partagé entre espaces »): its
-- éphémérides replace the planned periods of the contexts.
--
-- Existing data changes here:
-- * every treasury context becomes a kind of éphémérides with « Sert de contexte au budget » on, in its workspace, with
--   its label (followed by « (contexte) » when a kind of the workspace already has that label), color, image,
--   archiving and order (after the kinds already there); the context row stays (same id: its lines and budgets keep
--   it) and is linked to that kind; its own label, color, image, position and archiving columns are dropped (the kind
--   holds them);
-- * every planned period becomes a whole-day éphéméride of that kind (every day from its first to its last day, both
--   included), labelled as the context, its note becoming the first comment of the éphéméride;
-- * the planned periods table is dropped.
-- Contexts without periods become kinds without éphémérides. PostgreSQL 9.6 compatible.

ALTER TABLE "ScheduleType"
  ADD COLUMN "ephemeris" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "budgetContext" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sharedContext" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkSchedule" ADD COLUMN "ephemeris" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TreasuryContext" ADD COLUMN "scheduleTypeId" TEXT;

-- The kind of each context, its label free in the workspace.
CREATE TEMPORARY TABLE "_context_kind" AS
SELECT c."id" AS "contextId",
       'c' || md5(random()::text || clock_timestamp()::text || c."id") AS "typeId",
       c."label" AS "contextLabel",
       CASE
         WHEN NOT EXISTS (SELECT 1 FROM "ScheduleType" t WHERE t."workspaceId" = c."workspaceId" AND t."label" = c."label") THEN c."label"
         WHEN NOT EXISTS (SELECT 1 FROM "ScheduleType" t WHERE t."workspaceId" = c."workspaceId" AND t."label" = left(c."label", 239) || ' (contexte)')
          AND NOT EXISTS (SELECT 1 FROM "TreasuryContext" o WHERE o."workspaceId" = c."workspaceId" AND o."label" = left(c."label", 239) || ' (contexte)')
           THEN left(c."label", 239) || ' (contexte)'
         ELSE left(c."label", 200) || ' (contexte ' || c."id" || ')'
       END AS "label",
       c."color",
       c."iconId",
       c."archivedAt",
       c."createdAt",
       c."workspaceId",
       (SELECT COALESCE(MAX(t."position"), -1) FROM "ScheduleType" t WHERE t."workspaceId" = c."workspaceId")
         + row_number() OVER (PARTITION BY c."workspaceId" ORDER BY c."position", c."createdAt") AS "position"
FROM "TreasuryContext" c;

INSERT INTO "ScheduleType" ("id", "label", "iconId", "color", "dayDisplay", "dayBar", "monthDisplay", "ephemeris", "budgetContext", "sharedContext", "position", "archivedAt", "createdAt", "workspaceId")
SELECT k."typeId", k."label", k."iconId", k."color", 'SLOT_BACKGROUND', true, 'BACKGROUND', true, true, false, k."position", k."archivedAt", k."createdAt", k."workspaceId"
FROM "_context_kind" k;

UPDATE "TreasuryContext" AS c
SET "scheduleTypeId" = k."typeId"
FROM "_context_kind" k
WHERE k."contextId" = c."id";

-- One whole-day éphéméride per planned period: every day, from its first to its last day.
CREATE TEMPORARY TABLE "_period_ephemeris" AS
SELECT p."id" AS "periodId",
       'c' || md5(random()::text || clock_timestamp()::text || p."id") AS "scheduleId",
       k."typeId",
       k."contextLabel",
       p."startDate",
       p."endDate",
       p."note",
       p."createdAt",
       p."workspaceId"
FROM "TreasuryContextPeriod" p
JOIN "_context_kind" k ON k."contextId" = p."contextId";

INSERT INTO "WorkSchedule" ("id", "label", "typeId", "ephemeris", "startDate", "endDate", "intervalWeeks", "slots", "pauses", "cases", "exceptions", "createdAt", "updatedAt", "workspaceId")
SELECT e."scheduleId", e."contextLabel", e."typeId", true, e."startDate", e."endDate", 1, '[]'::jsonb, '[]'::jsonb,
       '[{"since":null,"until":null,"anchor":null,"rule":{"frequency":"DAILY","interval":1,"weekdays":[],"weekParity":null,"monthlyMode":"DAY","until":null,"count":null,"exceptions":[],"pauses":[]},"times":{"allDay":true,"ranges":[]}}]'::jsonb,
       '[]'::jsonb, e."createdAt", CURRENT_TIMESTAMP, e."workspaceId"
FROM "_period_ephemeris" e;

INSERT INTO "Comment" ("id", "body", "createdAt", "updatedAt", "scheduleId", "workspaceId")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || e."periodId" || 'note'), e."note", e."createdAt", e."createdAt", e."scheduleId", e."workspaceId"
FROM "_period_ephemeris" e
WHERE e."note" IS NOT NULL AND btrim(e."note") <> '';

DROP TABLE "_period_ephemeris";
DROP TABLE "_context_kind";

DROP TABLE "TreasuryContextPeriod";

ALTER TABLE "TreasuryContext" ALTER COLUMN "scheduleTypeId" SET NOT NULL;
DROP INDEX "TreasuryContext_workspaceId_label_key";
ALTER TABLE "TreasuryContext" DROP CONSTRAINT "TreasuryContext_iconId_fkey";
ALTER TABLE "TreasuryContext"
  DROP COLUMN "label",
  DROP COLUMN "iconId",
  DROP COLUMN "color",
  DROP COLUMN "position",
  DROP COLUMN "archivedAt";

CREATE UNIQUE INDEX "TreasuryContext_workspaceId_scheduleTypeId_key" ON "TreasuryContext"("workspaceId", "scheduleTypeId");
CREATE INDEX "TreasuryContext_scheduleTypeId_idx" ON "TreasuryContext"("scheduleTypeId");
ALTER TABLE "TreasuryContext" ADD CONSTRAINT "TreasuryContext_scheduleTypeId_fkey" FOREIGN KEY ("scheduleTypeId") REFERENCES "ScheduleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
