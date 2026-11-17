-- AlterTable
ALTER TABLE "Calendar" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "CalendarCategory" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "DocumentStatus" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "MailLabel" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "color" TEXT,
ADD COLUMN     "iconId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProjectCategory" ADD COLUMN     "iconId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProjectStatus" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "RoutineCategory" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleType" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "SheetCategory" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingBaseList" ADD COLUMN     "color" TEXT,
ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingCategory" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingStorage" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingStore" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingUnit" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "StockLocation" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TaskPriority" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TaskStatus" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TaskTag" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TaskType" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryAccount" ADD COLUMN     "color" TEXT,
ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryCategory" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryContext" ADD COLUMN     "iconId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryCounterparty" ADD COLUMN     "color" TEXT,
ADD COLUMN     "iconId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TreasuryPaymentMethod" ADD COLUMN     "color" TEXT,
ADD COLUMN     "iconId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "ProjectCategory" ADD CONSTRAINT "ProjectCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatus" ADD CONSTRAINT "TaskStatus_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPriority" ADD CONSTRAINT "TaskPriority_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskType" ADD CONSTRAINT "TaskType_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLabel" ADD CONSTRAINT "MailLabel_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarCategory" ADD CONSTRAINT "CalendarCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleType" ADD CONSTRAINT "ScheduleType_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatus" ADD CONSTRAINT "DocumentStatus_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryContext" ADD CONSTRAINT "TreasuryContext_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryCategory" ADD CONSTRAINT "TreasuryCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryPaymentMethod" ADD CONSTRAINT "TreasuryPaymentMethod_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryCounterparty" ADD CONSTRAINT "TreasuryCounterparty_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingCategory" ADD CONSTRAINT "ShoppingCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingStore" ADD CONSTRAINT "ShoppingStore_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingStorage" ADD CONSTRAINT "ShoppingStorage_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingUnit" ADD CONSTRAINT "ShoppingUnit_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingBaseList" ADD CONSTRAINT "ShoppingBaseList_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetCategory" ADD CONSTRAINT "SheetCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCategory" ADD CONSTRAINT "RoutineCategory_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Manual order of the lists that had none: by name to start with.
UPDATE "ProjectCategory" AS item SET "position" = ranked.rank FROM (SELECT "id", row_number() OVER (PARTITION BY "workspaceId" ORDER BY "name") - 1 AS rank FROM "ProjectCategory") AS ranked WHERE item."id" = ranked."id";
UPDATE "TreasuryPaymentMethod" AS item SET "position" = ranked.rank FROM (SELECT "id", row_number() OVER (PARTITION BY "workspaceId" ORDER BY "name") - 1 AS rank FROM "TreasuryPaymentMethod") AS ranked WHERE item."id" = ranked."id";
UPDATE "TreasuryCounterparty" AS item SET "position" = ranked.rank FROM (SELECT "id", row_number() OVER (PARTITION BY "workspaceId" ORDER BY "name") - 1 AS rank FROM "TreasuryCounterparty") AS ranked WHERE item."id" = ranked."id";
UPDATE "Place" AS item SET "position" = ranked.rank FROM (SELECT "id", row_number() OVER (PARTITION BY "workspaceId", "parentId" ORDER BY "name") - 1 AS rank FROM "Place") AS ranked WHERE item."id" = ranked."id";
