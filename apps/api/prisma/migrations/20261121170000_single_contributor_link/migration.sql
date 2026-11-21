-- A contributor is linked to one of a membership of the team or household, a relation or a client contact, at most.
--
-- Existing data changes here: a relation linked to a contributor that is a member (flagged "teamMember", or the app
-- user) loses that link ("contributorId" set to null); the contributor stays a member, the relation stays, with its
-- own details. Nothing else is modified. A contributor cannot be both a member and linked to a contact, nor linked to
-- a relation and a contact: the link to a contact is new and was only ever saved alone. PostgreSQL 9.6 compatible.

UPDATE "TreasuryRelation" r
SET "contributorId" = NULL
FROM "Contributor" c
WHERE r."contributorId" = c."id" AND (c."teamMember" = true OR c."userId" IS NOT NULL);
