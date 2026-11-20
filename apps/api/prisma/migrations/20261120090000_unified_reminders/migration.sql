-- Reminders work the same way for tasks, routines and events (decision D16), 10 at most per item, mixed kinds, stored
-- as JSON: [{ "before": minutes, "at": null }] (minutes before a moment, 0 = « Au début », 24 hours at most) or
-- [{ "before": null, "at": "HH:MM" }] (a time of the day of the item's day, Paris time).

-- Tasks: reminders at times of the day (« À HH:MM »), rung every day from « Date min » to « Date max ». None for the
-- existing tasks.
ALTER TABLE "Task" ADD COLUMN "reminders" JSONB NOT NULL DEFAULT '[]';

-- DATA CHANGE (events): each stored minute value becomes { "before": minutes, "at": null }, in the same order. The
-- reminders of more than 24 hours (more than 1 440 minutes: « 2 jours avant », « 1 semaine avant », or any other
-- value above) are removed; those of exactly 1 440 minutes (« 1 jour avant ») stay.
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderList" JSONB NOT NULL DEFAULT '[]';
UPDATE "CalendarEvent"
SET "reminderList" = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('before', kept.minutes, 'at', NULL) ORDER BY kept.place)
    FROM unnest("reminders") WITH ORDINALITY AS kept(minutes, place)
    WHERE kept.minutes <= 1440
  ),
  '[]'::jsonb
);
ALTER TABLE "CalendarEvent" DROP COLUMN "reminders";
ALTER TABLE "CalendarEvent" RENAME COLUMN "reminderList" TO "reminders";

-- DATA CHANGE (routines): each stored minute value becomes { "before": minutes, "at": null }, in the same order;
-- nothing removed (they were already 24 hours at most).
ALTER TABLE "Routine" ADD COLUMN "reminderList" JSONB NOT NULL DEFAULT '[]';
UPDATE "Routine"
SET "reminderList" = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('before', kept.minutes, 'at', NULL) ORDER BY kept.place)
    FROM unnest("reminders") WITH ORDINALITY AS kept(minutes, place)
  ),
  '[]'::jsonb
);
ALTER TABLE "Routine" DROP COLUMN "reminders";
ALTER TABLE "Routine" RENAME COLUMN "reminderList" TO "reminders";

-- DATA CHANGE (workspaces): alarms and reminders now ring whatever workspace is open, so « Alarmes » (ALARMS) and
-- « Rappels d’agenda » (CALENDAR) are no longer choices of « Notifier quand un autre espace est ouvert » : they are
-- removed from every workspace's choices; « Nouveaux mails » (MAILS) stays as chosen. The enum loses both values
-- (PostgreSQL 9.6 cannot drop an enum value: the type is made again).
UPDATE "Workspace" SET "notifyElsewhere" = array_remove(array_remove("notifyElsewhere", 'ALARMS'), 'CALENDAR');
ALTER TYPE "NotificationSource" RENAME TO "NotificationSource_old";
CREATE TYPE "NotificationSource" AS ENUM ('MAILS');
ALTER TABLE "Workspace" ALTER COLUMN "notifyElsewhere" DROP DEFAULT;
ALTER TABLE "Workspace" ALTER COLUMN "notifyElsewhere" TYPE "NotificationSource"[] USING ("notifyElsewhere"::text[]::"NotificationSource"[]);
ALTER TABLE "Workspace" ALTER COLUMN "notifyElsewhere" SET DEFAULT ARRAY[]::"NotificationSource"[];
DROP TYPE "NotificationSource_old";
