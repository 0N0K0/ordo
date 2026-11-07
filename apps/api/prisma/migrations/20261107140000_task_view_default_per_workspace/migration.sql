-- One default view per project (or home page) in each workspace, not across all of them.
DROP INDEX IF EXISTS "TaskView_single_default";
CREATE UNIQUE INDEX "TaskView_single_default" ON "TaskView" ("workspaceId", COALESCE("projectId", '')) WHERE "isDefault";
