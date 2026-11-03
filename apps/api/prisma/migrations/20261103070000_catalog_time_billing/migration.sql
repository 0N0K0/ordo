-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "documentId" TEXT;

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "kind" "AccountingLineKind" NOT NULL DEFAULT 'ITEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unit" "AccountingUnit" NOT NULL DEFAULT 'UNIT',
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_documentId_idx" ON "TimeEntry"("documentId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "AccountingDocument" ADD COLUMN     "billingSchedule" TEXT,
ADD COLUMN     "depositType" "DiscountType",
ADD COLUMN     "depositValue" DECIMAL(14,2);

-- Payment terms and late interest: short values, chosen from a list or completed.
ALTER TABLE "CompanyProfile" ALTER COLUMN "paymentTerms" SET DEFAULT 'À 30 jours',
ALTER COLUMN "lateInterest" SET DEFAULT 'Trois fois le taux d’intérêt légal';
UPDATE "CompanyProfile" SET "paymentTerms" = 'À 30 jours' WHERE "paymentTerms" = 'Paiement à 30 jours à compter de la date de facture.';
UPDATE "CompanyProfile" SET "lateInterest" = 'Trois fois le taux d’intérêt légal' WHERE "lateInterest" LIKE 'En cas de retard de paiement, pénalités au taux de trois fois le taux d’intérêt légal%';
