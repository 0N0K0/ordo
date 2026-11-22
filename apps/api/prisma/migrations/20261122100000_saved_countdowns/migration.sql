-- AlterTable
ALTER TABLE "Countdown" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "sheetId" TEXT;

-- CreateTable
CREATE TABLE "SavedCountdown" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconId" TEXT,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL,
    "ringtone" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "SavedCountdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TaskSavedCountdowns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskSavedCountdowns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SheetSavedCountdowns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SheetSavedCountdowns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EventSavedCountdowns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventSavedCountdowns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoutineSavedCountdowns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineSavedCountdowns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SavedCountdown_workspaceId_idx" ON "SavedCountdown"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCountdown_workspaceId_label_key" ON "SavedCountdown"("workspaceId", "label");

-- CreateIndex
CREATE INDEX "_TaskSavedCountdowns_B_index" ON "_TaskSavedCountdowns"("B");

-- CreateIndex
CREATE INDEX "_SheetSavedCountdowns_B_index" ON "_SheetSavedCountdowns"("B");

-- CreateIndex
CREATE INDEX "_EventSavedCountdowns_B_index" ON "_EventSavedCountdowns"("B");

-- CreateIndex
CREATE INDEX "_RoutineSavedCountdowns_B_index" ON "_RoutineSavedCountdowns"("B");

-- AddForeignKey
ALTER TABLE "SavedCountdown" ADD CONSTRAINT "SavedCountdown_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCountdown" ADD CONSTRAINT "SavedCountdown_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskSavedCountdowns" ADD CONSTRAINT "_TaskSavedCountdowns_A_fkey" FOREIGN KEY ("A") REFERENCES "SavedCountdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskSavedCountdowns" ADD CONSTRAINT "_TaskSavedCountdowns_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetSavedCountdowns" ADD CONSTRAINT "_SheetSavedCountdowns_A_fkey" FOREIGN KEY ("A") REFERENCES "SavedCountdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SheetSavedCountdowns" ADD CONSTRAINT "_SheetSavedCountdowns_B_fkey" FOREIGN KEY ("B") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSavedCountdowns" ADD CONSTRAINT "_EventSavedCountdowns_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSavedCountdowns" ADD CONSTRAINT "_EventSavedCountdowns_B_fkey" FOREIGN KEY ("B") REFERENCES "SavedCountdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineSavedCountdowns" ADD CONSTRAINT "_RoutineSavedCountdowns_A_fkey" FOREIGN KEY ("A") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoutineSavedCountdowns" ADD CONSTRAINT "_RoutineSavedCountdowns_B_fkey" FOREIGN KEY ("B") REFERENCES "SavedCountdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

