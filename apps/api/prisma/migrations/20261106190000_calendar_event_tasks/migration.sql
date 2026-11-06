-- CreateTable
CREATE TABLE "_CalendarEventTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CalendarEventTasks_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CalendarEventTasks_B_index" ON "_CalendarEventTasks"("B");

-- AddForeignKey
ALTER TABLE "_CalendarEventTasks" ADD CONSTRAINT "_CalendarEventTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventTasks" ADD CONSTRAINT "_CalendarEventTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

