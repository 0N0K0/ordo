-- An archived kind of schedules is never shown in another workspace: archiving a kind removes the subscriptions of the
-- other workspaces to it, for good (restoring it does not bring them back).
--
-- Existing data changes here: every row of "WorkScheduleSubscription" whose kind is archived ("ScheduleType"."archivedAt"
-- not null) is deleted, with its color, display and « Indisponible » set in the subscribing workspace. Nothing else is
-- modified: the kinds, their schedules, the subscriptions to schedules without kind ("typeId" null) and the other
-- subscriptions stay. PostgreSQL 9.6 compatible.

DELETE FROM "WorkScheduleSubscription" s
USING "ScheduleType" t
WHERE s."typeId" = t."id" AND t."archivedAt" IS NOT NULL;
