-- CreateEnum
CREATE TYPE "TreasuryDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "TreasuryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "TreasuryDirection" NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryPaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "incoming" BOOLEAN NOT NULL DEFAULT true,
    "outgoing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryCounterparty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryCounterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TreasuryEntryLinks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryEntryLinks_AB_pkey" PRIMARY KEY ("A","B")
);

-- AlterTable
ALTER TABLE "TreasuryEntry" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "counterpartyId" TEXT,
ADD COLUMN     "methodId" TEXT,
ADD COLUMN     "valueDate" DATE;

-- Free text categories become categories, one per name and direction (sign of the entries using it).
INSERT INTO "TreasuryCategory" ("id", "name", "direction")
SELECT 'c' || md5(random()::text || clock_timestamp()::text), "name", "direction"::"TreasuryDirection"
FROM (
  SELECT DISTINCT btrim("category") AS "name", CASE WHEN "amount" < 0 THEN 'OUT' ELSE 'IN' END AS "direction"
  FROM "TreasuryEntry"
  WHERE "category" IS NOT NULL AND btrim("category") <> ''
) AS "used";

UPDATE "TreasuryEntry" AS e
SET "categoryId" = c."id"
FROM "TreasuryCategory" AS c
WHERE e."category" IS NOT NULL
  AND c."name" = btrim(e."category")
  AND c."direction" = (CASE WHEN e."amount" < 0 THEN 'OUT' ELSE 'IN' END)::"TreasuryDirection";

-- Free text payment methods become payment methods, for money in and / or out as used.
INSERT INTO "TreasuryPaymentMethod" ("id", "name", "incoming", "outgoing")
SELECT 'c' || md5(random()::text || clock_timestamp()::text), btrim("method"), bool_or("amount" >= 0), bool_or("amount" < 0)
FROM "TreasuryEntry"
WHERE "method" IS NOT NULL AND btrim("method") <> ''
GROUP BY btrim("method");

UPDATE "TreasuryEntry" AS e
SET "methodId" = m."id"
FROM "TreasuryPaymentMethod" AS m
WHERE e."method" IS NOT NULL AND m."name" = btrim(e."method");

-- AlterTable
ALTER TABLE "TreasuryEntry" DROP COLUMN "category",
DROP COLUMN "method";

-- CreateIndex
CREATE INDEX "TreasuryCategory_parentId_idx" ON "TreasuryCategory"("parentId");

-- CreateIndex
CREATE INDEX "_TreasuryEntryLinks_B_index" ON "_TreasuryEntryLinks"("B");

-- CreateIndex
CREATE INDEX "TreasuryEntry_categoryId_idx" ON "TreasuryEntry"("categoryId");

-- CreateIndex
CREATE INDEX "TreasuryEntry_methodId_idx" ON "TreasuryEntry"("methodId");

-- CreateIndex
CREATE INDEX "TreasuryEntry_clientId_idx" ON "TreasuryEntry"("clientId");

-- CreateIndex
CREATE INDEX "TreasuryEntry_counterpartyId_idx" ON "TreasuryEntry"("counterpartyId");

-- AddForeignKey
ALTER TABLE "TreasuryCategory" ADD CONSTRAINT "TreasuryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TreasuryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TreasuryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "TreasuryPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "TreasuryCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryEntryLinks" ADD CONSTRAINT "_TreasuryEntryLinks_A_fkey" FOREIGN KEY ("A") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryEntryLinks" ADD CONSTRAINT "_TreasuryEntryLinks_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
