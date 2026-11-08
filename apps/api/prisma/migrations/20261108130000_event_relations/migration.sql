-- CreateTable
CREATE TABLE "_CalendarEventToTreasuryRelation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CalendarEventToTreasuryRelation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CalendarEventToTreasuryRelation_B_index" ON "_CalendarEventToTreasuryRelation"("B");

-- AddForeignKey
ALTER TABLE "_CalendarEventToTreasuryRelation" ADD CONSTRAINT "_CalendarEventToTreasuryRelation_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CalendarEventToTreasuryRelation" ADD CONSTRAINT "_CalendarEventToTreasuryRelation_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

