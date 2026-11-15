-- CreateTable
CREATE TABLE "SheetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "SheetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SheetCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SheetCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SheetCategory_workspaceId_idx" ON "SheetCategory"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SheetCategory_workspaceId_name_key" ON "SheetCategory"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "_SheetCategories_B_index" ON "_SheetCategories"("B");

-- AddForeignKey
ALTER TABLE "SheetCategory" ADD CONSTRAINT "SheetCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetCategories" ADD CONSTRAINT "_SheetCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetCategories" ADD CONSTRAINT "_SheetCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "SheetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

