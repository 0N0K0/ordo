-- AlterTable
ALTER TABLE "Contributor" ADD COLUMN     "githubLogin" TEXT;

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "githubIterationId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "githubContentId" TEXT,
ADD COLUMN     "githubContentType" TEXT,
ADD COLUMN     "githubItemId" TEXT,
ADD COLUMN     "githubNumber" INTEGER,
ADD COLUMN     "githubSnapshot" JSONB,
ADD COLUMN     "githubUrl" TEXT;

-- CreateTable
CREATE TABLE "GithubConnection" (
    "id" TEXT NOT NULL DEFAULT 'github',
    "token" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubProjectLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "githubProjectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statusFieldId" TEXT,
    "priorityFieldId" TEXT,
    "iterationFieldId" TEXT,
    "startFieldId" TEXT,
    "endFieldId" TEXT,
    "effortFieldId" TEXT,
    "statusOptions" JSONB NOT NULL DEFAULT '{}',
    "priorityOptions" JSONB NOT NULL DEFAULT '{}',
    "repositoryId" TEXT,
    "repositoryName" TEXT,
    "pushExisting" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubProjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubProjectLink_projectId_key" ON "GithubProjectLink"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_githubLogin_key" ON "Contributor"("githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_githubIterationId_key" ON "Sprint"("githubIterationId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_githubItemId_key" ON "Task"("githubItemId");

-- AddForeignKey
ALTER TABLE "GithubProjectLink" ADD CONSTRAINT "GithubProjectLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

