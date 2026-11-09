-- AlterTable
ALTER TABLE "AccountingLine" ADD COLUMN     "deductedDocumentId" TEXT;

-- CreateIndex
CREATE INDEX "AccountingLine_deductedDocumentId_idx" ON "AccountingLine"("deductedDocumentId");

-- AddForeignKey
ALTER TABLE "AccountingLine" ADD CONSTRAINT "AccountingLine_deductedDocumentId_fkey" FOREIGN KEY ("deductedDocumentId") REFERENCES "AccountingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

