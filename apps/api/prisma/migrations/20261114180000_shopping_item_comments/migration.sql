-- Comments on the items of the shopping lists.
ALTER TABLE "Comment" ADD COLUMN "shoppingItemId" TEXT;

CREATE INDEX "Comment_shoppingItemId_idx" ON "Comment"("shoppingItemId");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_shoppingItemId_fkey" FOREIGN KEY ("shoppingItemId") REFERENCES "ShoppingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
