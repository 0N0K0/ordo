-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "sheetItemId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN     "sheetSources" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Sheet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "projectId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetItem" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "productId" TEXT,
    "label" TEXT NOT NULL,
    "categoryId" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "SheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetLink" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "multiplier" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "routineId" TEXT,
    "eventId" TEXT,
    "taskId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "SheetLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "routineId" TEXT,
    "eventId" TEXT,
    "taskId" TEXT,
    "occurrenceDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT,
    "label" TEXT NOT NULL,
    "categoryId" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "note" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "checkedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sheet_projectId_idx" ON "Sheet"("projectId");

-- CreateIndex
CREATE INDEX "Sheet_workspaceId_idx" ON "Sheet"("workspaceId");

-- CreateIndex
CREATE INDEX "SheetItem_sheetId_idx" ON "SheetItem"("sheetId");

-- CreateIndex
CREATE INDEX "SheetItem_productId_idx" ON "SheetItem"("productId");

-- CreateIndex
CREATE INDEX "SheetItem_categoryId_idx" ON "SheetItem"("categoryId");

-- CreateIndex
CREATE INDEX "SheetItem_workspaceId_idx" ON "SheetItem"("workspaceId");

-- CreateIndex
CREATE INDEX "SheetLink_sheetId_idx" ON "SheetLink"("sheetId");

-- CreateIndex
CREATE INDEX "SheetLink_routineId_idx" ON "SheetLink"("routineId");

-- CreateIndex
CREATE INDEX "SheetLink_eventId_idx" ON "SheetLink"("eventId");

-- CreateIndex
CREATE INDEX "SheetLink_taskId_idx" ON "SheetLink"("taskId");

-- CreateIndex
CREATE INDEX "SheetLink_workspaceId_idx" ON "SheetLink"("workspaceId");

-- CreateIndex
CREATE INDEX "Checklist_taskId_idx" ON "Checklist"("taskId");

-- CreateIndex
CREATE INDEX "Checklist_workspaceId_idx" ON "Checklist"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_routineId_occurrenceDate_key" ON "Checklist"("routineId", "occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_eventId_occurrenceDate_key" ON "Checklist"("eventId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "ChecklistItem_listId_idx" ON "ChecklistItem"("listId");

-- CreateIndex
CREATE INDEX "ChecklistItem_productId_idx" ON "ChecklistItem"("productId");

-- CreateIndex
CREATE INDEX "ChecklistItem_categoryId_idx" ON "ChecklistItem"("categoryId");

-- CreateIndex
CREATE INDEX "ChecklistItem_workspaceId_idx" ON "ChecklistItem"("workspaceId");

-- CreateIndex
CREATE INDEX "Comment_sheetItemId_idx" ON "Comment"("sheetItemId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sheetItemId_fkey" FOREIGN KEY ("sheetItemId") REFERENCES "SheetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetItem" ADD CONSTRAINT "SheetItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetLink" ADD CONSTRAINT "SheetLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShoppingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShoppingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

