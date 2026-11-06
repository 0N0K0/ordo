-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "calledOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postponedFromDate" DATE,
ADD COLUMN     "postponedFromId" TEXT;

-- AlterTable
ALTER TABLE "CalendarEventException" ADD COLUMN     "calledOff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "pauses" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_postponedFromId_idx" ON "CalendarEvent"("postponedFromId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_postponedFromId_fkey" FOREIGN KEY ("postponedFromId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

