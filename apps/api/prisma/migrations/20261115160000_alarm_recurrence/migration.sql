-- Repetition of an alarm in the common form (rule with its end, pauses, deleted dates); none: its former fields.
ALTER TABLE "Alarm" ADD COLUMN "recurrence" JSONB;
