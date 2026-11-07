-- CreateEnum
CREATE TYPE "ScheduledMailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "MailLabel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMark" (
    "accountId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "labelIds" TEXT[],
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MailMark_pkey" PRIMARY KEY ("accountId","messageId")
);

-- CreateTable
CREATE TABLE "ScheduledMail" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "to" TEXT[],
    "raw" BYTEA NOT NULL,
    "copy" BYTEA NOT NULL,
    "recipients" TEXT[],
    "references" TEXT[],
    "projectId" TEXT,
    "status" "ScheduledMailStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledMail_status_sendAt_idx" ON "ScheduledMail"("status", "sendAt");

-- AddForeignKey
ALTER TABLE "MailMark" ADD CONSTRAINT "MailMark_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMail" ADD CONSTRAINT "ScheduledMail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

