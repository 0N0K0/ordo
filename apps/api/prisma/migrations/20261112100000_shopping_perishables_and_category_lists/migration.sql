-- AlterTable
ALTER TABLE "ShoppingProduct" ADD COLUMN     "expiresAt" DATE,
ADD COLUMN     "perishable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storageId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "expiresAt" DATE,
ADD COLUMN     "perishable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storageId" TEXT;

-- CreateTable
CREATE TABLE "ShoppingStorage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShoppingCategoryBaseLists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingCategoryBaseLists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ShoppingStorage_workspaceId_idx" ON "ShoppingStorage"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingStorage_workspaceId_name_key" ON "ShoppingStorage"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "_ShoppingCategoryBaseLists_B_index" ON "_ShoppingCategoryBaseLists"("B");

-- CreateIndex
CREATE INDEX "ShoppingProduct_storageId_idx" ON "ShoppingProduct"("storageId");

-- CreateIndex
CREATE INDEX "ShoppingItem_storageId_idx" ON "ShoppingItem"("storageId");

-- AddForeignKey
ALTER TABLE "ShoppingStorage" ADD CONSTRAINT "ShoppingStorage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_storageId_fkey" FOREIGN KEY ("storageId") REFERENCES "ShoppingStorage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_storageId_fkey" FOREIGN KEY ("storageId") REFERENCES "ShoppingStorage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingCategoryBaseLists" ADD CONSTRAINT "_ShoppingCategoryBaseLists_A_fkey" FOREIGN KEY ("A") REFERENCES "ShoppingBaseList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingCategoryBaseLists" ADD CONSTRAINT "_ShoppingCategoryBaseLists_B_fkey" FOREIGN KEY ("B") REFERENCES "ShoppingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

