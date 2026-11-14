-- AlterTable
ALTER TABLE "TaskView" ADD COLUMN "tableKey" TEXT;

-- One default view per scope, kind and table.
DROP INDEX IF EXISTS "TaskView_single_default";
CREATE UNIQUE INDEX "TaskView_single_default" ON "TaskView" ("workspaceId", "kind", COALESCE("tableKey", ''), COALESCE("projectId", '')) WHERE "isDefault";
