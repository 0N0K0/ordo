-- Documents linked to tasks, routines and events: of the library (LibraryDocument) and of the projects
-- (ProjectResource), as the treasury lines have them. Implicit many-to-many tables of Prisma (A, B: the two models in
-- alphabetical order); deleting a document, or the item, deletes its links.
--
-- Additive: six new tables; no existing data changes. PostgreSQL 9.6 compatible.

-- CreateTable
CREATE TABLE "_TaskLibraryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskLibraryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskProjectResources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskProjectResources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoutineLibraryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineLibraryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoutineProjectResources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineProjectResources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EventLibraryDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventLibraryDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EventProjectResources" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventProjectResources_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskLibraryDocuments_B_index" ON "_TaskLibraryDocuments"("B");

-- CreateIndex
CREATE INDEX "_TaskProjectResources_B_index" ON "_TaskProjectResources"("B");

-- CreateIndex
CREATE INDEX "_RoutineLibraryDocuments_B_index" ON "_RoutineLibraryDocuments"("B");

-- CreateIndex
CREATE INDEX "_RoutineProjectResources_B_index" ON "_RoutineProjectResources"("B");

-- CreateIndex
CREATE INDEX "_EventLibraryDocuments_B_index" ON "_EventLibraryDocuments"("B");

-- CreateIndex
CREATE INDEX "_EventProjectResources_B_index" ON "_EventProjectResources"("B");

-- AddForeignKey
ALTER TABLE "_TaskLibraryDocuments" ADD CONSTRAINT "_TaskLibraryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskLibraryDocuments" ADD CONSTRAINT "_TaskLibraryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskProjectResources" ADD CONSTRAINT "_TaskProjectResources_A_fkey" FOREIGN KEY ("A") REFERENCES "ProjectResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskProjectResources" ADD CONSTRAINT "_TaskProjectResources_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineLibraryDocuments" ADD CONSTRAINT "_RoutineLibraryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineLibraryDocuments" ADD CONSTRAINT "_RoutineLibraryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineProjectResources" ADD CONSTRAINT "_RoutineProjectResources_A_fkey" FOREIGN KEY ("A") REFERENCES "ProjectResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineProjectResources" ADD CONSTRAINT "_RoutineProjectResources_B_fkey" FOREIGN KEY ("B") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventLibraryDocuments" ADD CONSTRAINT "_EventLibraryDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventLibraryDocuments" ADD CONSTRAINT "_EventLibraryDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventProjectResources" ADD CONSTRAINT "_EventProjectResources_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventProjectResources" ADD CONSTRAINT "_EventProjectResources_B_fkey" FOREIGN KEY ("B") REFERENCES "ProjectResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
