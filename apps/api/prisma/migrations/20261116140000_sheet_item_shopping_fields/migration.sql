-- Sheet items get the fields of the shopping items (store, link, conservation, whom it is for), and both can be
-- optional (bought if possible).
-- AlterTable
ALTER TABLE "SheetItem" ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "perishable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storageId" TEXT,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_SheetItemMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SheetItemMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SheetItemRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SheetItemRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SheetItemMembers_B_index" ON "_SheetItemMembers"("B");

-- CreateIndex
CREATE INDEX "_SheetItemRelations_B_index" ON "_SheetItemRelations"("B");

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ShoppingStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_storageId_fkey" FOREIGN KEY ("storageId") REFERENCES "ShoppingStorage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetItemMembers" ADD CONSTRAINT "_SheetItemMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetItemMembers" ADD CONSTRAINT "_SheetItemMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "SheetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetItemRelations" ADD CONSTRAINT "_SheetItemRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "SheetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetItemRelations" ADD CONSTRAINT "_SheetItemRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

