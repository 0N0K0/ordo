-- A name is unique among the zones of a place, no longer in the whole workspace (two houses can each have a kitchen).
DROP INDEX "Place_workspaceId_name_key";
CREATE UNIQUE INDEX "Place_workspaceId_parentId_name_key" ON "Place"("workspaceId", "parentId", "name");
