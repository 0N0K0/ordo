-- An archived calendar is never shown in another workspace: archiving a calendar removes the subscriptions of the
-- other workspaces to it, for good (restoring it does not bring them back).
--
-- Existing data changes here: every row of "CalendarSubscription" whose calendar is archived ("Calendar"."archivedAt"
-- not null) is deleted. Nothing else is modified: the calendars, their events and the other subscriptions stay.
-- PostgreSQL 9.6 compatible.

DELETE FROM "CalendarSubscription" s
USING "Calendar" c
WHERE s."calendarId" = c."id" AND c."archivedAt" IS NOT NULL;
