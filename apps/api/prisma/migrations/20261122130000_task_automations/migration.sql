-- Automations of the tasks: rules « quand … alors … » of a workspace (a settings list: name, color, image, order,
-- archive), each with its trigger, its optional condition (a filter of the task table) and its actions, on or off.
--
-- Additive: one new table; no existing data changes. PostgreSQL 9.6 compatible.

-- CreateTable
CREATE TABLE "TaskAutomation" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconId" TEXT,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL,
    "condition" JSONB,
    "actions" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "TaskAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAutomation_workspaceId_idx" ON "TaskAutomation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAutomation_workspaceId_label_key" ON "TaskAutomation"("workspaceId", "label");

-- AddForeignKey
ALTER TABLE "TaskAutomation" ADD CONSTRAINT "TaskAutomation_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "Icon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAutomation" ADD CONSTRAINT "TaskAutomation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
