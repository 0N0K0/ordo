-- Tasks no longer repeat (routines do): the repetition of a series, the link from an occurrence to its series and its
-- date in the series are no longer read. The occurrences already created stay, as ordinary tasks.

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_seriesId_fkey";

-- DropIndex
DROP INDEX "Task_seriesId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "recurrence",
DROP COLUMN "seriesId",
DROP COLUMN "occurrenceDate";
