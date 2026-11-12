-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "routineId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RoutineCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "RoutineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "parentId" TEXT,
    "startDate" DATE NOT NULL,
    "recurrence" JSONB NOT NULL,
    "estimate" INTEGER,
    "projectId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineDependency" (
    "routineId" TEXT NOT NULL,
    "requiredId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "RoutineDependency_pkey" PRIMARY KEY ("routineId","requiredId")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "routineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("routineId","date")
);

-- CreateTable
CREATE TABLE "_RoutineAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "RoutineCategory_parentId_idx" ON "RoutineCategory"("parentId");

-- CreateIndex
CREATE INDEX "RoutineCategory_workspaceId_idx" ON "RoutineCategory"("workspaceId");

-- CreateIndex
CREATE INDEX "Routine_categoryId_idx" ON "Routine"("categoryId");

-- CreateIndex
CREATE INDEX "Routine_parentId_idx" ON "Routine"("parentId");

-- CreateIndex
CREATE INDEX "Routine_projectId_idx" ON "Routine"("projectId");

-- CreateIndex
CREATE INDEX "Routine_workspaceId_idx" ON "Routine"("workspaceId");

-- CreateIndex
CREATE INDEX "RoutineDependency_requiredId_idx" ON "RoutineDependency"("requiredId");

-- CreateIndex
CREATE INDEX "RoutineDependency_workspaceId_idx" ON "RoutineDependency"("workspaceId");

-- CreateIndex
CREATE INDEX "RoutineCheck_workspaceId_idx" ON "RoutineCheck"("workspaceId");

-- CreateIndex
CREATE INDEX "_RoutineAssignees_B_index" ON "_RoutineAssignees"("B");

-- CreateIndex
CREATE INDEX "TimeEntry_routineId_idx" ON "TimeEntry"("routineId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCategory" ADD CONSTRAINT "RoutineCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RoutineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCategory" ADD CONSTRAINT "RoutineCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RoutineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDependency" ADD CONSTRAINT "RoutineDependency_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDependency" ADD CONSTRAINT "RoutineDependency_requiredId_fkey" FOREIGN KEY ("requiredId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDependency" ADD CONSTRAINT "RoutineDependency_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineAssignees" ADD CONSTRAINT "_RoutineAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineAssignees" ADD CONSTRAINT "_RoutineAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

