-- « Bénéficiaires »: whom a task, a routine or an event is for (contributors, and people out of the team or household).
CREATE TABLE "_TaskBeneficiaries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskBeneficiaries_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_TaskBeneficiaries_B_index" ON "_TaskBeneficiaries"("B");
ALTER TABLE "_TaskBeneficiaries" ADD CONSTRAINT "_TaskBeneficiaries_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TaskBeneficiaries" ADD CONSTRAINT "_TaskBeneficiaries_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_TaskBeneficiaryRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskBeneficiaryRelations_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_TaskBeneficiaryRelations_B_index" ON "_TaskBeneficiaryRelations"("B");
ALTER TABLE "_TaskBeneficiaryRelations" ADD CONSTRAINT "_TaskBeneficiaryRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TaskBeneficiaryRelations" ADD CONSTRAINT "_TaskBeneficiaryRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_RoutineBeneficiaries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineBeneficiaries_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_RoutineBeneficiaries_B_index" ON "_RoutineBeneficiaries"("B");
ALTER TABLE "_RoutineBeneficiaries" ADD CONSTRAINT "_RoutineBeneficiaries_A_fkey" FOREIGN KEY ("A") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoutineBeneficiaries" ADD CONSTRAINT "_RoutineBeneficiaries_B_fkey" FOREIGN KEY ("B") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_RoutineBeneficiaryRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoutineBeneficiaryRelations_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_RoutineBeneficiaryRelations_B_index" ON "_RoutineBeneficiaryRelations"("B");
ALTER TABLE "_RoutineBeneficiaryRelations" ADD CONSTRAINT "_RoutineBeneficiaryRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoutineBeneficiaryRelations" ADD CONSTRAINT "_RoutineBeneficiaryRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_EventBeneficiaries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventBeneficiaries_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_EventBeneficiaries_B_index" ON "_EventBeneficiaries"("B");
ALTER TABLE "_EventBeneficiaries" ADD CONSTRAINT "_EventBeneficiaries_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EventBeneficiaries" ADD CONSTRAINT "_EventBeneficiaries_B_fkey" FOREIGN KEY ("B") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_EventBeneficiaryRelations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventBeneficiaryRelations_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_EventBeneficiaryRelations_B_index" ON "_EventBeneficiaryRelations"("B");
ALTER TABLE "_EventBeneficiaryRelations" ADD CONSTRAINT "_EventBeneficiaryRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EventBeneficiaryRelations" ADD CONSTRAINT "_EventBeneficiaryRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "TreasuryRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
