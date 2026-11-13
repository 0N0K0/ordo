-- CreateTable
CREATE TABLE "_ShoppingListTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingListTasks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ShoppingListTasks_B_index" ON "_ShoppingListTasks"("B");

-- AddForeignKey
ALTER TABLE "_ShoppingListTasks" ADD CONSTRAINT "_ShoppingListTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingListTasks" ADD CONSTRAINT "_ShoppingListTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: each list keeps its task, now as one of its tasks.
INSERT INTO "_ShoppingListTasks" ("A", "B")
SELECT "id", "taskId" FROM "ShoppingList" WHERE "taskId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ShoppingList" DROP CONSTRAINT "ShoppingList_taskId_fkey";

-- DropIndex
DROP INDEX "ShoppingList_taskId_idx";

-- AlterTable
ALTER TABLE "ShoppingList" DROP COLUMN "taskId";
