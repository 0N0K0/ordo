-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "milestoneId" TEXT;

-- AlterTable
ALTER TABLE "TaskView" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contributorId" TEXT;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "User_contributorId_key" ON "User"("contributorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskView" ADD CONSTRAINT "TaskView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One default view per scope: each project, and the home page (projectId NULL).
DROP INDEX IF EXISTS "TaskView_single_default";
CREATE UNIQUE INDEX "TaskView_single_default" ON "TaskView" (COALESCE("projectId", '')) WHERE "isDefault";

-- Contributor profile ("Moi") of existing users; the handle comes from the username
-- ("." is not allowed in handles) and gets a suffix when already taken.
INSERT INTO "Contributor" ("id", "name", "handle", "createdAt")
SELECT
  'me-' || u."id",
  u."username",
  CASE
    WHEN EXISTS (SELECT 1 FROM "Contributor" c WHERE c."handle" = regexp_replace(u."username", '[^a-z0-9_-]', '-', 'g'))
      THEN regexp_replace(u."username", '[^a-z0-9_-]', '-', 'g') || '-moi'
    ELSE regexp_replace(u."username", '[^a-z0-9_-]', '-', 'g')
  END,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."contributorId" IS NULL;

UPDATE "User" SET "contributorId" = 'me-' || "id" WHERE "contributorId" IS NULL;
