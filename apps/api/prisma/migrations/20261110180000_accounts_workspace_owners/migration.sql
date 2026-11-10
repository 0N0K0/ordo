-- Accounts: the admin (the oldest account) manages the others; each workspace belongs to an account.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

ALTER TYPE "AuthTokenType" ADD VALUE 'ACCOUNT_SETUP';

ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "passwordPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

ALTER TABLE "Workspace" ADD COLUMN     "ownerId" TEXT;

CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The existing account (the oldest one) is the admin and owns every existing workspace. Without any account yet
-- (a new install), the workspaces stay unclaimed: the first account, created from the command line, takes them.
UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt", "id" LIMIT 1);
UPDATE "Workspace" SET "ownerId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1) WHERE "ownerId" IS NULL;
