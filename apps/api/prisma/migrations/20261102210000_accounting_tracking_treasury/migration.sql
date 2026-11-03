-- CreateEnum
CREATE TYPE "DocumentStatusScope" AS ENUM ('QUOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "DocumentStatusCategory" AS ENUM ('TO_SEND', 'SENT', 'ACCEPTED', 'REFUSED', 'PAID');

-- CreateEnum
CREATE TYPE "TreasuryEntryStatus" AS ENUM ('ACTUAL', 'FORECAST');

-- AlterTable
ALTER TABLE "AccountingDocument" ADD COLUMN     "acceptedAt" DATE,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "signedAttachmentId" TEXT,
ADD COLUMN     "trackingStatusId" TEXT;

-- AlterTable
ALTER TABLE "ImportedDocument" ADD COLUMN     "settled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DocumentStatus" (
    "id" TEXT NOT NULL,
    "scope" "DocumentStatusScope" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "DocumentStatusCategory" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReminder" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" DATE NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "TreasuryEntryStatus" NOT NULL DEFAULT 'ACTUAL',
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" TEXT,
    "method" TEXT,
    "projectId" TEXT,
    "note" TEXT,
    "recurrence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAllocation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "documentId" TEXT,
    "importedDocumentId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "TreasuryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStatus_scope_name_key" ON "DocumentStatus"("scope", "name");

-- CreateIndex
CREATE INDEX "DocumentReminder_documentId_idx" ON "DocumentReminder"("documentId");

-- CreateIndex
CREATE INDEX "TreasuryEntry_accountId_date_idx" ON "TreasuryEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "TreasuryEntry_status_date_idx" ON "TreasuryEntry"("status", "date");

-- CreateIndex
CREATE INDEX "TreasuryAllocation_entryId_idx" ON "TreasuryAllocation"("entryId");

-- CreateIndex
CREATE INDEX "TreasuryAllocation_documentId_idx" ON "TreasuryAllocation"("documentId");

-- CreateIndex
CREATE INDEX "TreasuryAllocation_importedDocumentId_idx" ON "TreasuryAllocation"("importedDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_signedAttachmentId_key" ON "AccountingDocument"("signedAttachmentId");

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_trackingStatusId_fkey" FOREIGN KEY ("trackingStatusId") REFERENCES "DocumentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_signedAttachmentId_fkey" FOREIGN KEY ("signedAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReminder" ADD CONSTRAINT "DocumentReminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAllocation" ADD CONSTRAINT "TreasuryAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAllocation" ADD CONSTRAINT "TreasuryAllocation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAllocation" ADD CONSTRAINT "TreasuryAllocation_importedDocumentId_fkey" FOREIGN KEY ("importedDocumentId") REFERENCES "ImportedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Default tracking statuses (renamed, recolored, completed in the settings).
INSERT INTO "DocumentStatus" ("id", "scope", "name", "color", "category", "position") VALUES
  ('status_quote_to_send', 'QUOTE', 'À envoyer', '#868e96', 'TO_SEND', 0),
  ('status_quote_sent', 'QUOTE', 'Envoyé', '#228be6', 'SENT', 1),
  ('status_quote_accepted', 'QUOTE', 'Accepté', '#40c057', 'ACCEPTED', 2),
  ('status_quote_refused', 'QUOTE', 'Refusé', '#fa5252', 'REFUSED', 3),
  ('status_invoice_to_send', 'INVOICE', 'À envoyer', '#868e96', 'TO_SEND', 0),
  ('status_invoice_sent', 'INVOICE', 'Envoyée', '#228be6', 'SENT', 1),
  ('status_invoice_paid', 'INVOICE', 'Payée', '#40c057', 'PAID', 2);

-- Final documents start "to send".
UPDATE "AccountingDocument" SET "trackingStatusId" = CASE WHEN "type" = 'QUOTE' THEN 'status_quote_to_send' ELSE 'status_invoice_to_send' END
WHERE "status" = 'FINAL';
