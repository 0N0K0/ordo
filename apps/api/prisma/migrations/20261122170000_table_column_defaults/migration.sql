-- Columns new views start with, for every data table of a workspace (by table key).
ALTER TABLE "Workspace" ADD COLUMN "tableColumns" JSONB;

-- Those of the task views become those of the « tasks » table; the old column stays, unused.
UPDATE "Workspace" SET "tableColumns" = jsonb_build_object('tasks', "taskColumns") WHERE "taskColumns" IS NOT NULL;
