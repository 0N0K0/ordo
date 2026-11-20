-- Lot 16 (decision FO): contributors (members of the team or household included) and relations gain a birth date
-- (YYYY-MM-DD, or --MM-DD when the year is not known), the reminders of their birthday, an email address and phone
-- numbers ([{ label, number }], as the clients and their contacts); éphémérides gain reminders. Additive only: new
-- nullable columns or JSON defaulting to an empty list, no existing data changed.
ALTER TABLE "Contributor" ADD COLUMN "birthDate" TEXT,
ADD COLUMN "birthdayReminders" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "email" TEXT,
ADD COLUMN "phones" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "TreasuryRelation" ADD COLUMN "birthDate" TEXT,
ADD COLUMN "birthdayReminders" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "email" TEXT,
ADD COLUMN "phones" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "WorkSchedule" ADD COLUMN "reminders" JSONB NOT NULL DEFAULT '[]';
