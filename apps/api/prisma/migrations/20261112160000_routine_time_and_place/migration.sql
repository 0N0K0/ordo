-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "dueTime" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLon" DOUBLE PRECISION,
ADD COLUMN     "travelAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travelBefore" INTEGER NOT NULL DEFAULT 0;

