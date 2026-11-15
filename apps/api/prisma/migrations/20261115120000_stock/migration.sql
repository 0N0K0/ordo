-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('PURCHASE', 'CONSUMPTION', 'COUNT', 'LOSS', 'CORRECTION');

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "consumable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "stockItemId" TEXT;

-- AlterTable
ALTER TABLE "SheetItem" ADD COLUMN     "consumable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "deliveryId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingList" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLon" DOUBLE PRECISION,
ADD COLUMN     "remote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ShoppingProduct" ADD COLUMN     "autoStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consumable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stockLocationId" TEXT,
ADD COLUMN     "stockTracked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "label" TEXT NOT NULL,
    "categoryId" TEXT,
    "unit" TEXT,
    "locationId" TEXT,
    "note" TEXT,
    "perishable" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "expiresAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "kind" "StockMovementKind" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "shoppingItemId" TEXT,
    "sheetId" TEXT,
    "checklistItemId" TEXT,
    "countId" TEXT,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "note" TEXT,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingDelivery" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "label" TEXT,
    "trackingUrl" TEXT,
    "pickup" BOOLEAN NOT NULL DEFAULT false,
    "windowFrom" DATE,
    "windowTo" DATE,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StockItemMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StockItemMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_StockItemRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StockItemRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "StockLocation_parentId_idx" ON "StockLocation"("parentId");

-- CreateIndex
CREATE INDEX "StockLocation_workspaceId_idx" ON "StockLocation"("workspaceId");

-- CreateIndex
CREATE INDEX "StockItem_productId_idx" ON "StockItem"("productId");

-- CreateIndex
CREATE INDEX "StockItem_categoryId_idx" ON "StockItem"("categoryId");

-- CreateIndex
CREATE INDEX "StockItem_locationId_idx" ON "StockItem"("locationId");

-- CreateIndex
CREATE INDEX "StockItem_workspaceId_idx" ON "StockItem"("workspaceId");

-- CreateIndex
CREATE INDEX "StockLot_itemId_idx" ON "StockLot"("itemId");

-- CreateIndex
CREATE INDEX "StockLot_workspaceId_idx" ON "StockLot"("workspaceId");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_lotId_idx" ON "StockMovement"("lotId");

-- CreateIndex
CREATE INDEX "StockMovement_shoppingItemId_idx" ON "StockMovement"("shoppingItemId");

-- CreateIndex
CREATE INDEX "StockMovement_sheetId_idx" ON "StockMovement"("sheetId");

-- CreateIndex
CREATE INDEX "StockMovement_checklistItemId_idx" ON "StockMovement"("checklistItemId");

-- CreateIndex
CREATE INDEX "StockMovement_countId_idx" ON "StockMovement"("countId");

-- CreateIndex
CREATE INDEX "StockMovement_workspaceId_idx" ON "StockMovement"("workspaceId");

-- CreateIndex
CREATE INDEX "StockCount_locationId_idx" ON "StockCount"("locationId");

-- CreateIndex
CREATE INDEX "StockCount_workspaceId_idx" ON "StockCount"("workspaceId");

-- CreateIndex
CREATE INDEX "ShoppingDelivery_listId_idx" ON "ShoppingDelivery"("listId");

-- CreateIndex
CREATE INDEX "ShoppingDelivery_workspaceId_idx" ON "ShoppingDelivery"("workspaceId");

-- CreateIndex
CREATE INDEX "_StockItemMembers_B_index" ON "_StockItemMembers"("B");

-- CreateIndex
CREATE INDEX "_StockItemRelations_B_index" ON "_StockItemRelations"("B");

-- CreateIndex
CREATE INDEX "Comment_stockItemId_idx" ON "Comment"("stockItemId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ShoppingDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_shoppingItemId_fkey" FOREIGN KEY ("shoppingItemId") REFERENCES "ShoppingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingDelivery" ADD CONSTRAINT "ShoppingDelivery_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingDelivery" ADD CONSTRAINT "ShoppingDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StockItemMembers" ADD CONSTRAINT "_StockItemMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StockItemMembers" ADD CONSTRAINT "_StockItemMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StockItemRelations" ADD CONSTRAINT "_StockItemRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StockItemRelations" ADD CONSTRAINT "_StockItemRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

