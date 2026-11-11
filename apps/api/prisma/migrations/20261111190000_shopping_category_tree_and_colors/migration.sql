-- DropIndex
DROP INDEX "ShoppingCategory_workspaceId_name_key";

-- AlterTable
ALTER TABLE "TreasuryCategory" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "TreasuryEntry" ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "ShoppingCategory" DROP COLUMN "position",
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingStore" ADD COLUMN     "color" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ShoppingCategory_parentId_idx" ON "ShoppingCategory"("parentId");

-- AddForeignKey
ALTER TABLE "ShoppingCategory" ADD CONSTRAINT "ShoppingCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

