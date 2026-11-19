-- Routines (decisions D12, D14, D15 of 2026-11-19).

-- D12: a sub-routine archived along with its parent is restored with it.
ALTER TABLE "Routine" ADD COLUMN "archivedByCascade" BOOLEAN NOT NULL DEFAULT false;

-- D14: « Relative à » between routines, symmetric, stored once with routineAId < routineBId.
CREATE TABLE "RoutineRelation" (
    "routineAId" TEXT NOT NULL,
    "routineBId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT current_setting('ordo.workspace'::text),

    CONSTRAINT "RoutineRelation_pkey" PRIMARY KEY ("routineAId","routineBId")
);

CREATE INDEX "RoutineRelation_routineBId_idx" ON "RoutineRelation"("routineBId");

CREATE INDEX "RoutineRelation_workspaceId_idx" ON "RoutineRelation"("workspaceId");

ALTER TABLE "RoutineRelation" ADD CONSTRAINT "RoutineRelation_routineAId_fkey" FOREIGN KEY ("routineAId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoutineRelation" ADD CONSTRAINT "RoutineRelation_routineBId_fkey" FOREIGN KEY ("routineBId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoutineRelation" ADD CONSTRAINT "RoutineRelation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- D15: one global manual order per workspace instead of an order among siblings. The positions are renumbered in the
-- order the list shows (depth first: each routine, then its sub-routines; siblings by position, then label), so that
-- nothing moves on screen.
WITH RECURSIVE ranked AS (
    SELECT "id", "parentId", ROW_NUMBER() OVER (PARTITION BY "workspaceId", "parentId" ORDER BY "position", "label", "id") AS "rank"
    FROM "Routine"
), tree AS (
    SELECT r."id", ARRAY[r."rank"] AS "path"
    FROM ranked r
    WHERE r."parentId" IS NULL
    UNION ALL
    SELECT c."id", t."path" || c."rank"
    FROM ranked c
    JOIN tree t ON c."parentId" = t."id"
), ordered AS (
    SELECT t."id", ROW_NUMBER() OVER (PARTITION BY r."workspaceId" ORDER BY t."path") - 1 AS "position"
    FROM tree t
    JOIN "Routine" r ON r."id" = t."id"
)
UPDATE "Routine" r
SET "position" = o."position"
FROM ordered o
WHERE r."id" = o."id";
