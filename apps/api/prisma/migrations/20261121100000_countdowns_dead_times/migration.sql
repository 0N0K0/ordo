-- Lot 17b (decision FT): timers (« minuteurs ») of the user, shared by the workspaces as the rings, and the dead times
-- (« temps morts ») of the tasks and routines. Several time chronos may run at once: no schema change for that.
--
-- Columns (with an empty list by default) and a table added only: no existing data changes. PostgreSQL 9.6 compatible.

ALTER TABLE "Task" ADD COLUMN "deadTimes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Routine" ADD COLUMN "deadTimes" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "Countdown" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3),
    "remainingSeconds" INTEGER,
    "ringtone" TEXT,
    "workspaceId" TEXT,
    "taskId" TEXT,
    "routineId" TEXT,
    "occurrenceDate" DATE,
    "subject" TEXT,
    "path" TEXT,
    "linkLabel" TEXT,
    "rungAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Countdown_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Countdown_userId_rungAt_idx" ON "Countdown"("userId", "rungAt");
CREATE INDEX "Countdown_endsAt_idx" ON "Countdown"("endsAt");

ALTER TABLE "Countdown" ADD CONSTRAINT "Countdown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
