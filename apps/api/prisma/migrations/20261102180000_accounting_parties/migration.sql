-- CreateEnum
CREATE TYPE "ClientKind" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "AccountingDocumentType" AS ENUM ('QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activityCode" TEXT,
ADD COLUMN     "address" JSONB,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "kind" "ClientKind" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phones" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "siren" TEXT,
ADD COLUMN     "siret" TEXT,
ADD COLUMN     "vatNumber" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "ClientService" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "email" TEXT,
    "phones" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "jobTitle" TEXT,
    "phones" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "name" TEXT NOT NULL DEFAULT '',
    "legalForm" TEXT,
    "capital" TEXT,
    "registration" TEXT,
    "siren" TEXT,
    "siret" TEXT,
    "activityCode" TEXT,
    "vatNumber" TEXT,
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "vatExemptionText" TEXT NOT NULL DEFAULT 'TVA non applicable, art. 293 B du CGI',
    "address" JSONB,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logoId" TEXT,
    "bankName" TEXT,
    "accountHolder" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Paiement à 30 jours à compter de la date de facture.',
    "paymentDays" INTEGER NOT NULL DEFAULT 30,
    "paymentMethods" TEXT NOT NULL DEFAULT 'Virement bancaire',
    "lateInterest" TEXT NOT NULL DEFAULT 'En cas de retard de paiement, pénalités au taux de trois fois le taux d’intérêt légal, et indemnité forfaitaire pour frais de recouvrement de 40 € (clients professionnels).',
    "otherMentions" TEXT NOT NULL DEFAULT 'Pas d’escompte pour paiement anticipé.',
    "referenceLabel" TEXT NOT NULL DEFAULT 'Référence dossier',
    "quoteValidityDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "type" "AccountingDocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("type","year")
);

-- CreateIndex
CREATE INDEX "ClientService_clientId_idx" ON "ClientService"("clientId");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- AddForeignKey
ALTER TABLE "ClientService" ADD CONSTRAINT "ClientService_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClientService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

