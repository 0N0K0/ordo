-- Lot 16c (decision FP): contributors (members of the team or household included) and relations have several email
-- addresses, a labelled list like their phones ([{ label, address }]); clients and their contacts keep one address
-- (the one invoices are sent to).
--
-- Existing data changes here: the email address of each contributor and relation, when it has one, becomes the single
-- entry of its list (empty label); the former column is then dropped. PostgreSQL 9.6 compatible.

ALTER TABLE "Contributor" ADD COLUMN "emails" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TreasuryRelation" ADD COLUMN "emails" JSONB NOT NULL DEFAULT '[]';

UPDATE "Contributor"
SET "emails" = json_build_array(json_build_object('label', '', 'address', "email"))::jsonb
WHERE "email" IS NOT NULL AND "email" <> '';

UPDATE "TreasuryRelation"
SET "emails" = json_build_array(json_build_object('label', '', 'address', "email"))::jsonb
WHERE "email" IS NOT NULL AND "email" <> '';

ALTER TABLE "Contributor" DROP COLUMN "email";
ALTER TABLE "TreasuryRelation" DROP COLUMN "email";
