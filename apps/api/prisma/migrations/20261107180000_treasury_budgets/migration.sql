-- CreateTable
CREATE TABLE "TreasuryBudget" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "memberId" TEXT,
    "contextId" TEXT,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "repeatEvery" INTEGER,
    "repeatUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TreasuryBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryBudget_workspaceId_month_idx" ON "TreasuryBudget"("workspaceId", "month");

-- CreateIndex
CREATE INDEX "TreasuryBudget_memberId_idx" ON "TreasuryBudget"("memberId");

-- CreateIndex
CREATE INDEX "TreasuryBudget_contextId_idx" ON "TreasuryBudget"("contextId");

-- CreateIndex
CREATE INDEX "TreasuryBudget_categoryId_idx" ON "TreasuryBudget"("categoryId");

-- AddForeignKey
ALTER TABLE "TreasuryBudget" ADD CONSTRAINT "TreasuryBudget_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryBudget" ADD CONSTRAINT "TreasuryBudget_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "TreasuryContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryBudget" ADD CONSTRAINT "TreasuryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TreasuryCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryBudget" ADD CONSTRAINT "TreasuryBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
