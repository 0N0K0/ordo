-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "creditNoteCategoryId" TEXT,
ADD COLUMN     "invoiceCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_invoiceCategoryId_fkey" FOREIGN KEY ("invoiceCategoryId") REFERENCES "TreasuryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_creditNoteCategoryId_fkey" FOREIGN KEY ("creditNoteCategoryId") REFERENCES "TreasuryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

