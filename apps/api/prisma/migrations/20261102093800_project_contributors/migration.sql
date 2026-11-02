-- CreateTable
CREATE TABLE "_ProjectContributors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectContributors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProjectContributors_B_index" ON "_ProjectContributors"("B");

-- AddForeignKey
ALTER TABLE "_ProjectContributors" ADD CONSTRAINT "_ProjectContributors_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectContributors" ADD CONSTRAINT "_ProjectContributors_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Attach every contributor already assigned to tasks of a project to that project (the app user is
-- always available and needs no attachment).
INSERT INTO "_ProjectContributors" ("A", "B")
SELECT DISTINCT ct."A", t."projectId"
FROM "_ContributorToTask" ct
JOIN "Task" t ON t."id" = ct."B"
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."contributorId" = ct."A");
