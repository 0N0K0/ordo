-- CreateTable
CREATE TABLE "ImportedDocument" (
    "id" TEXT NOT NULL,
    "type" "AccountingDocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "clientId" TEXT,
    "clientName" TEXT,
    "projectId" TEXT,
    "title" TEXT,
    "totalNet" DECIMAL(14,2) NOT NULL,
    "totalVat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "attachmentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedDocument_attachmentId_key" ON "ImportedDocument"("attachmentId");

-- CreateIndex
CREATE INDEX "ImportedDocument_clientId_idx" ON "ImportedDocument"("clientId");

-- CreateIndex
CREATE INDEX "ImportedDocument_projectId_idx" ON "ImportedDocument"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedDocument_type_number_key" ON "ImportedDocument"("type", "number");

-- AddForeignKey
ALTER TABLE "ImportedDocument" ADD CONSTRAINT "ImportedDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedDocument" ADD CONSTRAINT "ImportedDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedDocument" ADD CONSTRAINT "ImportedDocument_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

