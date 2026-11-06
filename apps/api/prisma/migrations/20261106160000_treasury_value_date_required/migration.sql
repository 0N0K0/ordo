-- Entries without a value date take their execution date.
UPDATE "TreasuryEntry" SET "valueDate" = "date" WHERE "valueDate" IS NULL;

-- AlterTable
ALTER TABLE "TreasuryEntry" ALTER COLUMN "valueDate" SET NOT NULL;
