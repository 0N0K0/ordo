-- Decision D19: a comment of an event or a routine is on one occurrence, no longer on the whole series.
-- "occurrenceDate" is the day of the occurrence (for a routine, the day of its ticks); null for a one-off event and
-- for every other item.
-- Only the column is added: no existing row changes here. The comments already there (null "occurrenceDate") on a
-- routine or a recurring event are placed by the API the first time they are read, with the occurrence rules of the
-- app, and saved then (routine: the occurrence current on the day the comment was written, Paris time; recurring
-- event: the first occurrence shown of its series).
ALTER TABLE "Comment" ADD COLUMN "occurrenceDate" DATE;
