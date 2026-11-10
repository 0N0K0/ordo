-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('PRO', 'PERSO');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'PRO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- The existing data makes up a professional workspace, named after the company.
INSERT INTO "Workspace" ("id", "name", "kind", "position", "updatedAt")
VALUES ('cwspro465745a448e599d01f83', COALESCE((SELECT NULLIF(btrim("name"), '') FROM "CompanyProfile" LIMIT 1), 'Pro'), 'PRO', 0, CURRENT_TIMESTAMP);

-- DropIndex
DROP INDEX "ProjectCategory_name_key";

-- DropIndex
DROP INDEX "ProjectStatus_name_key";

-- DropIndex
DROP INDEX "Contributor_handle_key";

-- DropIndex
DROP INDEX "Contributor_githubLogin_key";

-- DropIndex
DROP INDEX "TaskStatus_name_key";

-- DropIndex
DROP INDEX "TaskPriority_name_key";

-- DropIndex
DROP INDEX "TaskType_name_key";

-- DropIndex
DROP INDEX "TaskTag_name_key";

-- DropIndex
DROP INDEX "AccountingDocument_number_key";

-- DropIndex
DROP INDEX "ImportedDocument_type_number_key";

-- DropIndex
DROP INDEX "DocumentStatus_scope_name_key";


-- AlterTable
ALTER TABLE "Icon" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ClientService" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ClientContact" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ProjectCategory" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ProjectStatus" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Contributor" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskStatus" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskPriority" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskType" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskTag" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskStatusChange" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskBlock" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskRelation" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TaskView" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "GithubConnection" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83',
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GithubProjectLink" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "DashboardChart" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "DocumentFolder" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "LibraryDocument" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "Alarm" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailAccount" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailMessage" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailLabel" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailSearch" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailMark" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ScheduledMail" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "MailFolderCursor" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "CalendarCategory" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "CalendarEventException" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "WorkSchedule" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83',
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentSequence" DROP CONSTRAINT "DocumentSequence_pkey",
ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83',
ADD CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("workspaceId", "type", "year");

-- AlterTable
ALTER TABLE "AccountingDocument" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "AccountingLine" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ProjectResource" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "ImportedDocument" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "DocumentStatus" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "DocumentReminder" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryAccount" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryCategory" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryPaymentMethod" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryCounterparty" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryEntry" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';

-- AlterTable
ALTER TABLE "TreasuryAllocation" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'cwspro465745a448e599d01f83';


-- CreateIndex
CREATE INDEX "Icon_workspaceId_idx" ON "Icon"("workspaceId");

-- CreateIndex
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientService_workspaceId_idx" ON "ClientService"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientContact_workspaceId_idx" ON "ClientContact"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategory_workspaceId_name_key" ON "ProjectCategory"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_workspaceId_name_key" ON "ProjectStatus"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_workspaceId_handle_key" ON "Contributor"("workspaceId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_workspaceId_githubLogin_key" ON "Contributor"("workspaceId", "githubLogin");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_workspaceId_userId_key" ON "Contributor"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStatus_workspaceId_name_key" ON "TaskStatus"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPriority_workspaceId_name_key" ON "TaskPriority"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskType_workspaceId_name_key" ON "TaskType"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_workspaceId_name_key" ON "TaskTag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- CreateIndex
CREATE INDEX "TaskStatusChange_workspaceId_idx" ON "TaskStatusChange"("workspaceId");

-- CreateIndex
CREATE INDEX "TaskBlock_workspaceId_idx" ON "TaskBlock"("workspaceId");

-- CreateIndex
CREATE INDEX "TaskRelation_workspaceId_idx" ON "TaskRelation"("workspaceId");

-- CreateIndex
CREATE INDEX "TaskComment_workspaceId_idx" ON "TaskComment"("workspaceId");

-- CreateIndex
CREATE INDEX "TaskView_workspaceId_idx" ON "TaskView"("workspaceId");

-- CreateIndex
CREATE INDEX "Milestone_workspaceId_idx" ON "Milestone"("workspaceId");

-- CreateIndex
CREATE INDEX "Sprint_workspaceId_idx" ON "Sprint"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubConnection_workspaceId_key" ON "GithubConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "GithubProjectLink_workspaceId_idx" ON "GithubProjectLink"("workspaceId");

-- CreateIndex
CREATE INDEX "Dashboard_workspaceId_idx" ON "Dashboard"("workspaceId");

-- CreateIndex
CREATE INDEX "DashboardChart_workspaceId_idx" ON "DashboardChart"("workspaceId");

-- CreateIndex
CREATE INDEX "DocumentFolder_workspaceId_idx" ON "DocumentFolder"("workspaceId");

-- CreateIndex
CREATE INDEX "LibraryDocument_workspaceId_idx" ON "LibraryDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "Attachment_workspaceId_idx" ON "Attachment"("workspaceId");

-- CreateIndex
CREATE INDEX "TimeEntry_workspaceId_idx" ON "TimeEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "Alarm_workspaceId_idx" ON "Alarm"("workspaceId");

-- CreateIndex
CREATE INDEX "MailAccount_workspaceId_idx" ON "MailAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "MailMessage_workspaceId_idx" ON "MailMessage"("workspaceId");

-- CreateIndex
CREATE INDEX "MailLabel_workspaceId_idx" ON "MailLabel"("workspaceId");

-- CreateIndex
CREATE INDEX "MailSearch_workspaceId_idx" ON "MailSearch"("workspaceId");

-- CreateIndex
CREATE INDEX "MailMark_workspaceId_idx" ON "MailMark"("workspaceId");

-- CreateIndex
CREATE INDEX "ScheduledMail_workspaceId_idx" ON "ScheduledMail"("workspaceId");

-- CreateIndex
CREATE INDEX "MailFolderCursor_workspaceId_idx" ON "MailFolderCursor"("workspaceId");

-- CreateIndex
CREATE INDEX "CalendarCategory_workspaceId_idx" ON "CalendarCategory"("workspaceId");

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_idx" ON "CalendarEvent"("workspaceId");

-- CreateIndex
CREATE INDEX "CalendarEventException_workspaceId_idx" ON "CalendarEventException"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkSchedule_workspaceId_idx" ON "WorkSchedule"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_workspaceId_key" ON "CompanyProfile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_workspaceId_number_key" ON "AccountingDocument"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "AccountingLine_workspaceId_idx" ON "AccountingLine"("workspaceId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_workspaceId_idx" ON "RecurringInvoice"("workspaceId");

-- CreateIndex
CREATE INDEX "CatalogItem_workspaceId_idx" ON "CatalogItem"("workspaceId");

-- CreateIndex
CREATE INDEX "ProjectResource_workspaceId_idx" ON "ProjectResource"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedDocument_workspaceId_type_number_key" ON "ImportedDocument"("workspaceId", "type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStatus_workspaceId_scope_name_key" ON "DocumentStatus"("workspaceId", "scope", "name");

-- CreateIndex
CREATE INDEX "DocumentReminder_workspaceId_idx" ON "DocumentReminder"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryAccount_workspaceId_idx" ON "TreasuryAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryCategory_workspaceId_idx" ON "TreasuryCategory"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryPaymentMethod_workspaceId_idx" ON "TreasuryPaymentMethod"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryCounterparty_workspaceId_idx" ON "TreasuryCounterparty"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryEntry_workspaceId_idx" ON "TreasuryEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "TreasuryAllocation_workspaceId_idx" ON "TreasuryAllocation"("workspaceId");

-- AddForeignKey
ALTER TABLE "Icon" ADD CONSTRAINT "Icon_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientService" ADD CONSTRAINT "ClientService_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCategory" ADD CONSTRAINT "ProjectCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatus" ADD CONSTRAINT "TaskStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPriority" ADD CONSTRAINT "TaskPriority_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskType" ADD CONSTRAINT "TaskType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlock" ADD CONSTRAINT "TaskBlock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskView" ADD CONSTRAINT "TaskView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubConnection" ADD CONSTRAINT "GithubConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubProjectLink" ADD CONSTRAINT "GithubProjectLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardChart" ADD CONSTRAINT "DashboardChart_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLabel" ADD CONSTRAINT "MailLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailSearch" ADD CONSTRAINT "MailSearch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMark" ADD CONSTRAINT "MailMark_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledMail" ADD CONSTRAINT "ScheduledMail_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailFolderCursor" ADD CONSTRAINT "MailFolderCursor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarCategory" ADD CONSTRAINT "CalendarCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventException" ADD CONSTRAINT "CalendarEventException_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingLine" ADD CONSTRAINT "AccountingLine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedDocument" ADD CONSTRAINT "ImportedDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatus" ADD CONSTRAINT "DocumentStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReminder" ADD CONSTRAINT "DocumentReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryCategory" ADD CONSTRAINT "TreasuryCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryPaymentMethod" ADD CONSTRAINT "TreasuryPaymentMethod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryCounterparty" ADD CONSTRAINT "TreasuryCounterparty_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryEntry" ADD CONSTRAINT "TreasuryEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAllocation" ADD CONSTRAINT "TreasuryAllocation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New rows get their workspace from the app; the default fails outside one.
ALTER TABLE "Icon" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Client" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ClientService" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ClientContact" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ProjectCategory" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ProjectStatus" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Contributor" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskStatus" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskPriority" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskType" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskTag" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Task" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskStatusChange" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskBlock" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskRelation" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskComment" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TaskView" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Milestone" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Sprint" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "GithubConnection" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "GithubProjectLink" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Dashboard" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "DashboardChart" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "DocumentFolder" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "LibraryDocument" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Attachment" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TimeEntry" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "Alarm" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailAccount" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailMessage" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailLabel" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailSearch" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailMark" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ScheduledMail" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "MailFolderCursor" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "CalendarCategory" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "CalendarEvent" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "CalendarEventException" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "WorkSchedule" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "CompanyProfile" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "DocumentSequence" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "AccountingDocument" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "AccountingLine" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "RecurringInvoice" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "CatalogItem" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ProjectResource" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "ImportedDocument" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "DocumentStatus" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "DocumentReminder" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryAccount" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryCategory" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryPaymentMethod" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryCounterparty" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryEntry" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);
ALTER TABLE "TreasuryAllocation" ALTER COLUMN "workspaceId" SET DEFAULT current_setting('ordo.workspace'::text);

-- "Moi": the contributor of the user now belongs to the workspace.
UPDATE "Contributor" AS c SET "userId" = u."id" FROM "User" AS u WHERE u."contributorId" = c."id";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_contributorId_fkey";

-- DropIndex
DROP INDEX "User_contributorId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "contributorId";

-- The status history rows take the workspace of their task.
CREATE OR REPLACE FUNCTION "record_task_status"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "TaskStatusChange" ("id", "workspaceId", "taskId", "statusId", "closed", "at")
    VALUES ('c' || md5(random()::text || clock_timestamp()::text), NEW."workspaceId", NEW."id", NEW."statusId", NEW."closedAt" IS NOT NULL, NEW."createdAt");
  ELSIF NEW."statusId" IS DISTINCT FROM OLD."statusId" OR (NEW."closedAt" IS NULL) <> (OLD."closedAt" IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM "TaskStatusChange" WHERE "taskId" = NEW."id") THEN
      INSERT INTO "TaskStatusChange" ("id", "workspaceId", "taskId", "statusId", "closed", "at")
      VALUES ('c' || md5(random()::text || clock_timestamp()::text), OLD."workspaceId", OLD."id", OLD."statusId", OLD."closedAt" IS NOT NULL, OLD."createdAt");
    END IF;
    INSERT INTO "TaskStatusChange" ("id", "workspaceId", "taskId", "statusId", "closed", "at")
    VALUES ('c' || md5(random()::text || clock_timestamp()::text), NEW."workspaceId", NEW."id", NEW."statusId", NEW."closedAt" IS NOT NULL, now() AT TIME ZONE 'UTC');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
