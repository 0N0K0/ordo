-- Catalogue items, treasury accounts and counterparties: archived by date as every other element (the archived ones
-- keep being archived, as of now), the former flag dropped.

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "CatalogItem" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "archived";
ALTER TABLE "CatalogItem" DROP COLUMN "archived";

-- AlterTable
ALTER TABLE "TreasuryAccount" ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "TreasuryAccount" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "archived";
ALTER TABLE "TreasuryAccount" DROP COLUMN "archived";

-- AlterTable
ALTER TABLE "TreasuryCounterparty" ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "TreasuryCounterparty" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "archived";
ALTER TABLE "TreasuryCounterparty" DROP COLUMN "archived";

-- Mail labels: one name per workspace.
-- CreateIndex
CREATE UNIQUE INDEX "MailLabel_workspaceId_name_key" ON "MailLabel"("workspaceId", "name");
