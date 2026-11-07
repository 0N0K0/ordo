-- CreateEnum
CREATE TYPE "TreasuryLineMode" AS ENUM ('AMOUNT', 'PERCENT');

-- AlterTable
ALTER TABLE "Contributor" ADD COLUMN     "teamMember" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TreasuryEntryLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "mode" "TreasuryLineMode" NOT NULL DEFAULT 'AMOUNT',
    "value" DECIMAL(14,4) NOT NULL,
    "memberId" TEXT,
    "categoryId" TEXT,
    "contextId" TEXT,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TreasuryEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryContext" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TreasuryContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryContextPeriod" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TreasuryContextPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_entryId_idx" ON "TreasuryEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_memberId_idx" ON "TreasuryEntryLine"("memberId");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_categoryId_idx" ON "TreasuryEntryLine"("categoryId");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_contextId_idx" ON "TreasuryEntryLine"("contextId");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_workspaceId_idx" ON "TreasuryEntryLine"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryContext_workspaceId_name_key" ON "TreasuryContext"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "TreasuryContextPeriod_contextId_idx" ON "TreasuryContextPeriod"("contextId");

-- CreateIndex
CREATE INDEX "TreasuryContextPeriod_workspaceId_startDate_idx" ON "TreasuryContextPeriod"("workspaceId", "startDate");

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TreasuryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TreasuryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "TreasuryContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryContext" ADD CONSTRAINT "TreasuryContext_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryContextPeriod" ADD CONSTRAINT "TreasuryContextPeriod_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "TreasuryContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryContextPeriod" ADD CONSTRAINT "TreasuryContextPeriod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
