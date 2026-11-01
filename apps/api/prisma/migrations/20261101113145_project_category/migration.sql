/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CategoryToProject` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CategoryToProject" DROP CONSTRAINT "_CategoryToProject_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToProject" DROP CONSTRAINT "_CategoryToProject_B_fkey";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "_CategoryToProject";

-- CreateTable
CREATE TABLE "ProjectCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectToProjectCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectToProjectCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategory_name_key" ON "ProjectCategory"("name");

-- CreateIndex
CREATE INDEX "_ProjectToProjectCategory_B_index" ON "_ProjectToProjectCategory"("B");

-- AddForeignKey
ALTER TABLE "_ProjectToProjectCategory" ADD CONSTRAINT "_ProjectToProjectCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectToProjectCategory" ADD CONSTRAINT "_ProjectToProjectCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ProjectCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
