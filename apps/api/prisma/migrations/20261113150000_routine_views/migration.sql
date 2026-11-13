-- CreateEnum
CREATE TYPE "ViewKind" AS ENUM ('TASKS', 'ROUTINES');

-- AlterTable
ALTER TABLE "TaskView" ADD COLUMN     "kind" "ViewKind" NOT NULL DEFAULT 'TASKS';

-- One default view per scope and kind (the tasks and the routines of a page or of a project).
DROP INDEX IF EXISTS "TaskView_single_default";
CREATE UNIQUE INDEX "TaskView_single_default" ON "TaskView" ("workspaceId", "kind", COALESCE("projectId", '')) WHERE "isDefault";
