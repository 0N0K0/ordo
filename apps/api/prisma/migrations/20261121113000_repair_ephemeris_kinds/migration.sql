-- Repair of the kinds of éphémérides turned back into kinds of créneaux by a change (bug of the label service, fixed
-- with this migration: an omitted field of a change took its default, `ephemeris` false, on every change of a kind).
--
-- Existing data changes here: a kind of créneaux that serves as a budget context (only a kind of éphémérides can), or
-- that still has a schedule marked as an éphéméride (a deliberate conversion turns all its schedules), becomes a kind
-- of éphémérides again; then every schedule of a kind of éphémérides is marked as one. PostgreSQL 9.6 compatible.

UPDATE "ScheduleType" t
SET "ephemeris" = true
WHERE t."ephemeris" = false
  AND (t."budgetContext" = true OR EXISTS (SELECT 1 FROM "WorkSchedule" s WHERE s."typeId" = t."id" AND s."ephemeris" = true));

UPDATE "WorkSchedule" s
SET "ephemeris" = true
FROM "ScheduleType" t
WHERE s."typeId" = t."id" AND t."ephemeris" = true AND s."ephemeris" = false;
