-- CreateTable
CREATE TABLE "ShoppingCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "storeId" TEXT,
    "url" TEXT,
    "note" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "unitPrice" DECIMAL(14,2),
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "lastPurchasedAt" TIMESTAMP(3),
    "lastPrice" DECIMAL(14,2),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taskId" TEXT,
    "closedAt" TIMESTAMP(3),
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "storeId" TEXT,
    "url" TEXT,
    "note" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "unitPrice" DECIMAL(14,2),
    "purchasedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShoppingProductMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingProductMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ShoppingItemMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingItemMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ShoppingProductRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingProductRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ShoppingItemRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingItemRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ShoppingCategory_workspaceId_idx" ON "ShoppingCategory"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingCategory_workspaceId_name_key" ON "ShoppingCategory"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ShoppingStore_workspaceId_idx" ON "ShoppingStore"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingStore_workspaceId_name_key" ON "ShoppingStore"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ShoppingProduct_categoryId_idx" ON "ShoppingProduct"("categoryId");

-- CreateIndex
CREATE INDEX "ShoppingProduct_storeId_idx" ON "ShoppingProduct"("storeId");

-- CreateIndex
CREATE INDEX "ShoppingProduct_workspaceId_idx" ON "ShoppingProduct"("workspaceId");

-- CreateIndex
CREATE INDEX "ShoppingList_taskId_idx" ON "ShoppingList"("taskId");

-- CreateIndex
CREATE INDEX "ShoppingList_entryId_idx" ON "ShoppingList"("entryId");

-- CreateIndex
CREATE INDEX "ShoppingList_workspaceId_idx" ON "ShoppingList"("workspaceId");

-- CreateIndex
CREATE INDEX "ShoppingItem_listId_idx" ON "ShoppingItem"("listId");

-- CreateIndex
CREATE INDEX "ShoppingItem_productId_idx" ON "ShoppingItem"("productId");

-- CreateIndex
CREATE INDEX "ShoppingItem_workspaceId_idx" ON "ShoppingItem"("workspaceId");

-- CreateIndex
CREATE INDEX "_ShoppingProductMembers_B_index" ON "_ShoppingProductMembers"("B");

-- CreateIndex
CREATE INDEX "_ShoppingItemMembers_B_index" ON "_ShoppingItemMembers"("B");

-- CreateIndex
CREATE INDEX "_ShoppingProductRelations_B_index" ON "_ShoppingProductRelations"("B");

-- CreateIndex
CREATE INDEX "_ShoppingItemRelations_B_index" ON "_ShoppingItemRelations"("B");

-- AddForeignKey
ALTER TABLE "ShoppingCategory" ADD CONSTRAINT "ShoppingCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingStore" ADD CONSTRAINT "ShoppingStore_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ShoppingStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TreasuryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "ShoppingStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingProductMembers" ADD CONSTRAINT "_ShoppingProductMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingProductMembers" ADD CONSTRAINT "_ShoppingProductMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "ShoppingProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingItemMembers" ADD CONSTRAINT "_ShoppingItemMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingItemMembers" ADD CONSTRAINT "_ShoppingItemMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "ShoppingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingProductRelations" ADD CONSTRAINT "_ShoppingProductRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "ShoppingProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingProductRelations" ADD CONSTRAINT "_ShoppingProductRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingItemRelations" ADD CONSTRAINT "_ShoppingItemRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "ShoppingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingItemRelations" ADD CONSTRAINT "_ShoppingItemRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

