-- CreateEnum
CREATE TYPE "AccountingDocumentStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "AccountingLineKind" AS ENUM ('ITEM', 'DISBURSEMENT', 'TEXT', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "AccountingUnit" AS ENUM ('UNIT', 'HOUR', 'DAY', 'MONTH', 'FLAT', 'DEPOSIT');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "accountingDocumentId" TEXT;

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "type" "AccountingDocumentType" NOT NULL,
    "status" "AccountingDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "year" INTEGER,
    "counter" INTEGER,
    "number" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "serviceStart" DATE,
    "serviceEnd" DATE,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "contactId" TEXT,
    "projectId" TEXT,
    "sourceId" TEXT,
    "seller" JSONB,
    "buyer" JSONB,
    "title" TEXT,
    "introduction" TEXT,
    "referenceLabel" TEXT,
    "referenceValue" TEXT,
    "conclusion" TEXT,
    "paymentTerms" TEXT,
    "paymentMethods" TEXT,
    "lateInterest" TEXT,
    "otherMentions" TEXT,
    "showBankDetails" BOOLEAN NOT NULL DEFAULT true,
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "vatExemptionText" TEXT,
    "globalDiscountType" "DiscountType",
    "globalDiscountValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalVat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "AccountingLineKind" NOT NULL DEFAULT 'ITEM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" "AccountingUnit" NOT NULL DEFAULT 'UNIT',
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(14,2),

    CONSTRAINT "AccountingLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_number_key" ON "AccountingDocument"("number");

-- CreateIndex
CREATE INDEX "AccountingDocument_clientId_idx" ON "AccountingDocument"("clientId");

-- CreateIndex
CREATE INDEX "AccountingDocument_projectId_idx" ON "AccountingDocument"("projectId");

-- CreateIndex
CREATE INDEX "AccountingDocument_sourceId_idx" ON "AccountingDocument"("sourceId");

-- CreateIndex
CREATE INDEX "AccountingDocument_type_year_idx" ON "AccountingDocument"("type", "year");

-- CreateIndex
CREATE INDEX "AccountingLine_documentId_idx" ON "AccountingLine"("documentId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_accountingDocumentId_fkey" FOREIGN KEY ("accountingDocumentId") REFERENCES "AccountingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClientService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AccountingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingLine" ADD CONSTRAINT "AccountingLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

