-- Projects have a title rather than a name.
ALTER TABLE "Project" RENAME COLUMN "name" TO "title";
