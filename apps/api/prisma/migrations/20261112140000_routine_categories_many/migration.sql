-- CreateTable
CREATE TABLE "_RoutineCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RoutineCategories_B_index" ON "_RoutineCategories"("B");

-- AddForeignKey
ALTER TABLE "_RoutineCategories" ADD CONSTRAINT "_RoutineCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineCategories" ADD CONSTRAINT "_RoutineCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "RoutineCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: each routine keeps its category, now as one of its categories.
INSERT INTO "_RoutineCategories" ("A", "B")
SELECT "id", "categoryId" FROM "Routine" WHERE "categoryId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Routine" DROP CONSTRAINT "Routine_categoryId_fkey";

-- DropIndex
DROP INDEX "Routine_categoryId_idx";

-- AlterTable
ALTER TABLE "Routine" DROP COLUMN "categoryId";
