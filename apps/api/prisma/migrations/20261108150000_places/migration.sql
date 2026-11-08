-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CalendarEventException" ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLon" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_workspaceId_name_key" ON "Place"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

