-- CreateTable
CREATE TABLE "ShoppingBaseList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingBaseList_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable first: the existing products get a base list below)
ALTER TABLE "ShoppingProduct" ADD COLUMN     "baseListId" TEXT;

-- Data: one base list « Liste de base » per workspace that has products, holding all of them.
INSERT INTO "ShoppingBaseList" ("id", "name", "position", "workspaceId")
SELECT 'bl' || md5(random()::text || clock_timestamp()::text || w."workspaceId"), 'Liste de base', 0, w."workspaceId"
FROM (SELECT DISTINCT "workspaceId" FROM "ShoppingProduct") AS w;

UPDATE "ShoppingProduct" AS p
SET "baseListId" = b."id"
FROM "ShoppingBaseList" AS b
WHERE b."workspaceId" = p."workspaceId";

ALTER TABLE "ShoppingProduct" ALTER COLUMN "baseListId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ShoppingBaseList_workspaceId_idx" ON "ShoppingBaseList"("workspaceId");

-- CreateIndex
CREATE INDEX "ShoppingProduct_baseListId_idx" ON "ShoppingProduct"("baseListId");

-- AddForeignKey
ALTER TABLE "ShoppingBaseList" ADD CONSTRAINT "ShoppingBaseList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingProduct" ADD CONSTRAINT "ShoppingProduct_baseListId_fkey" FOREIGN KEY ("baseListId") REFERENCES "ShoppingBaseList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
