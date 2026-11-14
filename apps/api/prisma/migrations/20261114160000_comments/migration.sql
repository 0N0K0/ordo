-- Comments (markdown) of the items other than tasks: one target each (a row, or a mail by its Message-ID).
-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "routineId" TEXT,
    "eventId" TEXT,
    "scheduleId" TEXT,
    "timeEntryId" TEXT,
    "shoppingListId" TEXT,
    "shoppingProductId" TEXT,
    "documentId" TEXT,
    "importedDocumentId" TEXT,
    "catalogItemId" TEXT,
    "treasuryEntryId" TEXT,
    "budgetId" TEXT,
    "relationId" TEXT,
    "libraryDocumentId" TEXT,
    "mailMessageId" TEXT,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_routineId_idx" ON "Comment"("routineId");

-- CreateIndex
CREATE INDEX "Comment_eventId_idx" ON "Comment"("eventId");

-- CreateIndex
CREATE INDEX "Comment_scheduleId_idx" ON "Comment"("scheduleId");

-- CreateIndex
CREATE INDEX "Comment_timeEntryId_idx" ON "Comment"("timeEntryId");

-- CreateIndex
CREATE INDEX "Comment_shoppingListId_idx" ON "Comment"("shoppingListId");

-- CreateIndex
CREATE INDEX "Comment_shoppingProductId_idx" ON "Comment"("shoppingProductId");

-- CreateIndex
CREATE INDEX "Comment_documentId_idx" ON "Comment"("documentId");

-- CreateIndex
CREATE INDEX "Comment_importedDocumentId_idx" ON "Comment"("importedDocumentId");

-- CreateIndex
CREATE INDEX "Comment_catalogItemId_idx" ON "Comment"("catalogItemId");

-- CreateIndex
CREATE INDEX "Comment_treasuryEntryId_idx" ON "Comment"("treasuryEntryId");

-- CreateIndex
CREATE INDEX "Comment_budgetId_idx" ON "Comment"("budgetId");

-- CreateIndex
CREATE INDEX "Comment_relationId_idx" ON "Comment"("relationId");

-- CreateIndex
CREATE INDEX "Comment_libraryDocumentId_idx" ON "Comment"("libraryDocumentId");

-- CreateIndex
CREATE INDEX "Comment_mailMessageId_idx" ON "Comment"("mailMessageId");

-- CreateIndex
CREATE INDEX "Comment_workspaceId_idx" ON "Comment"("workspaceId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_shoppingProductId_fkey" FOREIGN KEY ("shoppingProductId") REFERENCES "ShoppingProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_importedDocumentId_fkey" FOREIGN KEY ("importedDocumentId") REFERENCES "ImportedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_treasuryEntryId_fkey" FOREIGN KEY ("treasuryEntryId") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "TreasuryBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_libraryDocumentId_fkey" FOREIGN KEY ("libraryDocumentId") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

