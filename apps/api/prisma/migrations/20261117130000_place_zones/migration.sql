-- Zones of a place (rooms of the house…): a parent place, no address nor point of their own.
ALTER TABLE "Place" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Place" ALTER COLUMN "lat" DROP NOT NULL;
ALTER TABLE "Place" ALTER COLUMN "lon" DROP NOT NULL;
ALTER TABLE "Place" ADD CONSTRAINT "Place_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
