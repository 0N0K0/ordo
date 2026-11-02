-- CreateEnum
CREATE TYPE "TaskStatusCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
-- AlterTable
ALTER TABLE "TaskStatus" ADD COLUMN     "category" "TaskStatusCategory" NOT NULL DEFAULT 'TODO';
-- CreateTable
CREATE TABLE "TaskView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskView_pkey" PRIMARY KEY ("id")
);

-- At most one default view.
CREATE UNIQUE INDEX "TaskView_single_default" ON "TaskView" ("isDefault") WHERE "isDefault";
