-- AlterTable
ALTER TABLE "ImportedDocument" ADD COLUMN     "trackingStatusId" TEXT;

-- AddForeignKey
ALTER TABLE "ImportedDocument" ADD CONSTRAINT "ImportedDocument_trackingStatusId_fkey" FOREIGN KEY ("trackingStatusId") REFERENCES "DocumentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

