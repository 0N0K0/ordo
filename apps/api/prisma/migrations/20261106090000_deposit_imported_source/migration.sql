-- Deposit invoices made from an imported quote.
ALTER TABLE "AccountingDocument" ADD COLUMN "importedSourceId" TEXT;

ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_importedSourceId_fkey" FOREIGN KEY ("importedSourceId") REFERENCES "ImportedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
