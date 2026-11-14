-- Week of a workspace: its first and last days (1 = Monday … 7 = Sunday), Monday to Sunday by default.
ALTER TABLE "Workspace" ADD COLUMN "weekStart" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Workspace" ADD COLUMN "weekEnd" INTEGER NOT NULL DEFAULT 7;
