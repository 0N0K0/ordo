-- GitHub links map the type, the deadline and the tracked time too; assignees and labels can be left out.
ALTER TABLE "GithubProjectLink" ADD COLUMN     "deadlineFieldId" TEXT,
ADD COLUMN     "syncAssignees" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "syncLabels" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timeSpentFieldId" TEXT,
ADD COLUMN     "typeFieldId" TEXT,
ADD COLUMN     "typeOptions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "typeSource" TEXT;
