-- A contributor has no details of its own any more (email addresses, phones, birth date, birthday reminders): they
-- come from what it is linked to, at most one of a membership of the team or household (its own row), a relation or a
-- client contact. This adds the link to a contact (a contact is one contributor at most).
--
-- Existing data changes here: for every relation linked to a contributor that is not a member (neither "teamMember"
-- nor the app user), each of the relation's details that is empty (no email address, no phone, no birth date, no
-- birthday reminder) takes the contributor's when it has one. Nothing else is modified: the contributor's own details
-- stay stored (unused while it is not a member), a relation's details already given are kept. PostgreSQL 9.6
-- compatible.

ALTER TABLE "Contributor" ADD COLUMN "contactId" TEXT;
CREATE UNIQUE INDEX "Contributor_contactId_key" ON "Contributor"("contactId");
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "TreasuryRelation" r
SET "emails" = c."emails"
FROM "Contributor" c
WHERE r."contributorId" = c."id" AND c."teamMember" = false AND c."userId" IS NULL
  AND r."emails" = '[]'::jsonb AND c."emails" <> '[]'::jsonb;

UPDATE "TreasuryRelation" r
SET "phones" = c."phones"
FROM "Contributor" c
WHERE r."contributorId" = c."id" AND c."teamMember" = false AND c."userId" IS NULL
  AND r."phones" = '[]'::jsonb AND c."phones" <> '[]'::jsonb;

UPDATE "TreasuryRelation" r
SET "birthDate" = c."birthDate"
FROM "Contributor" c
WHERE r."contributorId" = c."id" AND c."teamMember" = false AND c."userId" IS NULL
  AND r."birthDate" IS NULL AND c."birthDate" IS NOT NULL;

UPDATE "TreasuryRelation" r
SET "birthdayReminders" = c."birthdayReminders"
FROM "Contributor" c
WHERE r."contributorId" = c."id" AND c."teamMember" = false AND c."userId" IS NULL
  AND r."birthdayReminders" = '[]'::jsonb AND c."birthdayReminders" <> '[]'::jsonb;
