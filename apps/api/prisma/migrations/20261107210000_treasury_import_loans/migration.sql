-- AlterTable
ALTER TABLE "TreasuryAccount" ADD COLUMN     "csvMapping" JSONB;

-- AlterTable
ALTER TABLE "TreasuryEntryLine" ADD COLUMN     "date" DATE,
ADD COLUMN     "loan" BOOLEAN NOT NULL DEFAULT false;
