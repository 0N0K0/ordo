-- Client contacts are archived and restored (hidden by default, read only), with their contributor; archiving a client
-- archives its contacts and the contributors linked to them, flagged so that restoring the client restores only those.
--
-- Additive only: existing data is not modified (every contact stays active, nothing is flagged as archived along).
-- PostgreSQL 9.6 compatible.

ALTER TABLE "ClientContact" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ClientContact" ADD COLUMN "archivedByCascade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contributor" ADD COLUMN "archivedByCascade" BOOLEAN NOT NULL DEFAULT false;
