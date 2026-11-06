-- CreateTable
CREATE TABLE "_TreasuryEntryLibraryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryEntryLibraryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TreasuryEntryProjectResources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TreasuryEntryProjectResources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TreasuryEntryLibraryDocuments_B_index" ON "_TreasuryEntryLibraryDocuments"("B");

-- CreateIndex
CREATE INDEX "_TreasuryEntryProjectResources_B_index" ON "_TreasuryEntryProjectResources"("B");

-- AddForeignKey
ALTER TABLE "_TreasuryEntryLibraryDocuments" ADD CONSTRAINT "_TreasuryEntryLibraryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryEntryLibraryDocuments" ADD CONSTRAINT "_TreasuryEntryLibraryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryEntryProjectResources" ADD CONSTRAINT "_TreasuryEntryProjectResources_A_fkey" FOREIGN KEY ("A") REFERENCES "ProjectResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TreasuryEntryProjectResources" ADD CONSTRAINT "_TreasuryEntryProjectResources_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

