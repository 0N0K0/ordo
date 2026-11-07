-- AlterTable
ALTER TABLE "TreasuryBudget" ADD COLUMN     "relationId" TEXT;

-- AlterTable
ALTER TABLE "TreasuryEntryLine" ADD COLUMN     "relationId" TEXT;

-- CreateTable
CREATE TABLE "TreasuryRelation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "contributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TreasuryRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryRelation_workspaceId_name_key" ON "TreasuryRelation"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryRelation_workspaceId_contributorId_key" ON "TreasuryRelation"("workspaceId", "contributorId");

-- CreateIndex
CREATE INDEX "TreasuryBudget_relationId_idx" ON "TreasuryBudget"("relationId");

-- CreateIndex
CREATE INDEX "TreasuryEntryLine_relationId_idx" ON "TreasuryEntryLine"("relationId");

-- AddForeignKey
ALTER TABLE "TreasuryEntryLine" ADD CONSTRAINT "TreasuryEntryLine_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "TreasuryRelation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryRelation" ADD CONSTRAINT "TreasuryRelation_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryRelation" ADD CONSTRAINT "TreasuryRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryBudget" ADD CONSTRAINT "TreasuryBudget_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
