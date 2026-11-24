-- Sprints mirrored with the iterations of their GitHub board both ways: the values of the iteration at the last sync
-- on each sprint, the iterations paired at the last sync on each link (one without sprint since was deleted in Ordo),
-- the error that stops the iteration writes of a link, the choice to write the iterations on GitHub (off for every
-- link), the write sent but not checked yet, and the last refusal of GitHub.
--
-- New columns only, existing data unchanged. PostgreSQL 9.6 compatible.

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN "githubSnapshot" JSONB;

-- AlterTable
ALTER TABLE "GithubProjectLink" ADD COLUMN "iterationIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "GithubProjectLink" ADD COLUMN "iterationWriteError" TEXT;
ALTER TABLE "GithubProjectLink" ADD COLUMN "writeIterations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GithubProjectLink" ADD COLUMN "iterationWritePending" JSONB;
ALTER TABLE "GithubProjectLink" ADD COLUMN "iterationWriteRefusal" TEXT;
