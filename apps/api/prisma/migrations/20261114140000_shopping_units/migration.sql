-- Units of quantity of the shopping products and items, set per workspace (products keep their unit as text).
CREATE TABLE "ShoppingUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "ShoppingUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShoppingUnit_workspaceId_name_key" ON "ShoppingUnit"("workspaceId", "name");
CREATE INDEX "ShoppingUnit_workspaceId_idx" ON "ShoppingUnit"("workspaceId");
ALTER TABLE "ShoppingUnit" ADD CONSTRAINT "ShoppingUnit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every workspace starts with the units offered so far, then those its products and items already use.
INSERT INTO "ShoppingUnit" ("id", "name", "position", "workspaceId")
SELECT md5(random()::text || clock_timestamp()::text || w."id" || d."name"), d."name", d."position", w."id"
FROM "Workspace" w CROSS JOIN (VALUES
  ('pièce', 0),
  ('kg', 1),
  ('g', 2),
  ('L', 3),
  ('cl', 4),
  ('boîte', 5),
  ('paquet', 6),
  ('bouteille', 7),
  ('sachet', 8),
  ('lot', 9),
  ('rouleau', 10),
  ('carton', 11),
  ('paire', 12)
) AS d("name", "position");

INSERT INTO "ShoppingUnit" ("id", "name", "position", "workspaceId")
SELECT md5(random()::text || clock_timestamp()::text || u."workspaceId" || u."unit"), u."unit", 100 + (ROW_NUMBER() OVER (PARTITION BY u."workspaceId" ORDER BY u."unit"))::int, u."workspaceId"
FROM (
  SELECT DISTINCT "workspaceId", btrim("unit") AS "unit" FROM "ShoppingProduct" WHERE "unit" IS NOT NULL AND btrim("unit") <> ''
  UNION
  SELECT DISTINCT "workspaceId", btrim("unit") AS "unit" FROM "ShoppingItem" WHERE "unit" IS NOT NULL AND btrim("unit") <> ''
) u
WHERE NOT EXISTS (SELECT 1 FROM "ShoppingUnit" s WHERE s."workspaceId" = u."workspaceId" AND s."name" = u."unit");
