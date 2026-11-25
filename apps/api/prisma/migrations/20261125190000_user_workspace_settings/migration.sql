-- CreateTable
CREATE TABLE "UserWorkspaceSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "myDay" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "UserWorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWorkspaceSettings_userId_idx" ON "UserWorkspaceSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkspaceSettings_workspaceId_userId_key" ON "UserWorkspaceSettings"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "UserWorkspaceSettings" ADD CONSTRAINT "UserWorkspaceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspaceSettings" ADD CONSTRAINT "UserWorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
