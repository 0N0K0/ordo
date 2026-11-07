-- AlterTable
ALTER TABLE "TreasuryEntryLine" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "_TreasuryLineLibraryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryLineLibraryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TreasuryLineProjectResources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryLineProjectResources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TreasuryLineLinks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryLineLinks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TreasuryLineEntryLinks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryLineEntryLinks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TreasuryLineLibraryDocuments_B_index" ON "_TreasuryLineLibraryDocuments"("B");

-- CreateIndex
CREATE INDEX "_TreasuryLineProjectResources_B_index" ON "_TreasuryLineProjectResources"("B");

-- CreateIndex
CREATE INDEX "_TreasuryLineLinks_B_index" ON "_TreasuryLineLinks"("B");

-- CreateIndex
CREATE INDEX "_TreasuryLineEntryLinks_B_index" ON "_TreasuryLineEntryLinks"("B");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_projectId_idx" ON "TreasuryEntryLine"("projectId");

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineLibraryDocuments" ADD CONSTRAINT "_TreasuryLineLibraryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineLibraryDocuments" ADD CONSTRAINT "_TreasuryLineLibraryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineProjectResources" ADD CONSTRAINT "_TreasuryLineProjectResources_A_fkey" FOREIGN KEY ("A") REFERENCES "ProjectResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineProjectResources" ADD CONSTRAINT "_TreasuryLineProjectResources_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineLinks" ADD CONSTRAINT "_TreasuryLineLinks_A_fkey" FOREIGN KEY ("A") REFERENCES "TreasuryEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineLinks" ADD CONSTRAINT "_TreasuryLineLinks_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineEntryLinks" ADD CONSTRAINT "_TreasuryLineEntryLinks_A_fkey" FOREIGN KEY ("A") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryLineEntryLinks" ADD CONSTRAINT "_TreasuryLineEntryLinks_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
