-- Lot 17a (decision FS): settings of the rings of the user (every workspace) and the state of each ring (stopped,
-- snoozed, rung again), so a reload, another tab or another device (and the push notifications of lot 17c) follow it.
--
-- Columns and a table added only: no existing data changes. PostgreSQL 9.6 compatible.

ALTER TABLE "User" ADD COLUMN "ringSettings" JSONB;

CREATE TABLE "AlarmRing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "path" TEXT,
    "linkLabel" TEXT,
    "ringtone" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "ringingSince" TIMESTAMP(3),
    "nextAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlarmRing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlarmRing_userId_key_key" ON "AlarmRing"("userId", "key");
CREATE INDEX "AlarmRing_userId_updatedAt_idx" ON "AlarmRing"("userId", "updatedAt");

ALTER TABLE "AlarmRing" ADD CONSTRAINT "AlarmRing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
