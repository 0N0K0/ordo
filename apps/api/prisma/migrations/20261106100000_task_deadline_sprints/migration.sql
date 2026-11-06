-- "Date max" of a task: overdue is now measured against it.
ALTER TABLE "Task" ADD COLUMN "deadline" DATE;

-- Existing tasks keep their overdue state: their end date becomes their "Date max".
UPDATE "Task" SET "deadline" = "endDate" WHERE "endDate" IS NOT NULL;

CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");

-- A task may be planned in several sprints.
CREATE TABLE "_TaskSprints" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskSprints_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_TaskSprints_B_index" ON "_TaskSprints"("B");

ALTER TABLE "_TaskSprints" ADD CONSTRAINT "_TaskSprints_A_fkey" FOREIGN KEY ("A") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_TaskSprints" ADD CONSTRAINT "_TaskSprints_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The sprint of each task moves to the new table.
INSERT INTO "_TaskSprints" ("A", "B") SELECT "sprintId", "id" FROM "Task" WHERE "sprintId" IS NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT "Task_sprintId_fkey";

DROP INDEX "Task_sprintId_idx";

ALTER TABLE "Task" DROP COLUMN "sprintId";
